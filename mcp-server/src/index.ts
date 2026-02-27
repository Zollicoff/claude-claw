import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const GATEWAY_IPC_URL = process.env.CLAW_GATEWAY_IPC || 'http://127.0.0.1:19790';
const CLAW_DIR = join(homedir(), '.claude-claw');
const WORKSPACE_DIR = join(CLAW_DIR, 'workspace');
const MEMORY_DIR = join(CLAW_DIR, 'memory');

async function ipcFetch(path: string, options?: RequestInit): Promise<Response> {
  return fetch(`${GATEWAY_IPC_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
}

function textResult(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

const server = new McpServer({
  name: 'claw-bridge',
  version: '0.1.0',
});

// --- Messaging tools ---

server.tool(
  'send_message',
  'Send a message to a specific platform and channel via the claude-claw gateway',
  {
    platform: z.string().describe('Platform name: discord, telegram, webchat'),
    channel: z.string().describe('Channel or chat ID'),
    message: z.string().describe('Message content to send'),
  },
  async ({ platform, channel, message }) => {
    try {
      const res = await ipcFetch('/send-message', {
        method: 'POST',
        body: JSON.stringify({ platform, channel, message }),
      });
      const data = await res.json();
      return textResult(data.sent ? 'Message sent successfully' : `Failed: ${JSON.stringify(data)}`);
    } catch (err) {
      return textResult(`Error sending message: ${err}`);
    }
  },
);

server.tool(
  'get_channels',
  'List all available channels across connected messaging platforms',
  {},
  async () => {
    try {
      const res = await ipcFetch('/channels');
      const data = await res.json();
      return textResult(JSON.stringify(data.channels, null, 2));
    } catch (err) {
      return textResult(`Error fetching channels: ${err}`);
    }
  },
);

server.tool(
  'get_history',
  'Fetch recent conversation history from a platform channel',
  {
    platform: z.string().describe('Platform name'),
    channel: z.string().describe('Channel or chat ID'),
    limit: z.number().optional().describe('Max messages to return (default 50)'),
  },
  async ({ platform, channel, limit }) => {
    try {
      const params = new URLSearchParams({ platform, channel });
      if (limit) params.set('limit', String(limit));
      const res = await ipcFetch(`/history?${params}`);
      const data = await res.json();
      return textResult(JSON.stringify(data.history, null, 2));
    } catch (err) {
      return textResult(`Error fetching history: ${err}`);
    }
  },
);

// --- Canvas tools ---

server.tool(
  'canvas_update',
  'Push HTML content to the claude-claw canvas (visual workspace in browser)',
  {
    html: z.string().describe('HTML content to display on the canvas'),
  },
  async ({ html }) => {
    try {
      await ipcFetch('/canvas', {
        method: 'POST',
        body: JSON.stringify({ html }),
      });
      return textResult('Canvas updated');
    } catch (err) {
      return textResult(`Error updating canvas: ${err}`);
    }
  },
);

server.tool(
  'canvas_clear',
  'Clear the claude-claw canvas',
  {},
  async () => {
    try {
      await ipcFetch('/canvas', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      return textResult('Canvas cleared');
    } catch (err) {
      return textResult(`Error clearing canvas: ${err}`);
    }
  },
);

// --- Memory tools ---

server.tool(
  'memory_read',
  'Read from claude-claw persistent memory (workspace files or daily memory)',
  {
    key: z.string().describe('File to read: IDENTITY.md, SOUL.md, AGENTS.md, USER.md, MEMORY.md, or a date like 2026-02-23'),
  },
  async ({ key }) => {
    // Try workspace first, then memory dir
    const wsPath = join(WORKSPACE_DIR, key);
    if (existsSync(wsPath)) {
      return textResult(readFileSync(wsPath, 'utf-8'));
    }
    const memPath = join(MEMORY_DIR, key.endsWith('.md') ? key : `${key}.md`);
    if (existsSync(memPath)) {
      return textResult(readFileSync(memPath, 'utf-8'));
    }
    return textResult(`Not found: ${key}`);
  },
);

server.tool(
  'memory_write',
  'Write to claude-claw persistent memory',
  {
    key: z.string().describe('File to write: MEMORY.md for workspace memory, or a date like 2026-02-23 for daily memory'),
    value: z.string().describe('Content to write'),
  },
  async ({ key, value }) => {
    try {
      // Workspace files go to workspace dir
      const wsFiles = ['IDENTITY.md', 'SOUL.md', 'AGENTS.md', 'USER.md', 'MEMORY.md', 'HEARTBEAT.md'];
      if (wsFiles.includes(key)) {
        if (!existsSync(WORKSPACE_DIR)) mkdirSync(WORKSPACE_DIR, { recursive: true });
        writeFileSync(join(WORKSPACE_DIR, key), value);
        return textResult(`Written to workspace/${key}`);
      }
      // Everything else goes to memory dir as daily files
      if (!existsSync(MEMORY_DIR)) mkdirSync(MEMORY_DIR, { recursive: true });
      const memPath = join(MEMORY_DIR, key.endsWith('.md') ? key : `${key}.md`);
      writeFileSync(memPath, value);
      return textResult(`Written to memory/${key}`);
    } catch (err) {
      return textResult(`Error writing memory: ${err}`);
    }
  },
);

server.tool(
  'memory_search',
  'Search across claude-claw memory files for a query string',
  {
    query: z.string().describe('Search term to find in memory files'),
  },
  async ({ query }) => {
    const results: Array<{ file: string; matches: string[] }> = [];
    const lowerQuery = query.toLowerCase();

    const searchDir = (dir: string, prefix: string) => {
      if (!existsSync(dir)) return;
      for (const file of readdirSync(dir)) {
        if (!file.endsWith('.md')) continue;
        const content = readFileSync(join(dir, file), 'utf-8');
        const lines = content.split('\n');
        const matches = lines.filter((l) => l.toLowerCase().includes(lowerQuery));
        if (matches.length > 0) {
          results.push({ file: `${prefix}/${file}`, matches: matches.slice(0, 5) });
        }
      }
    };

    searchDir(WORKSPACE_DIR, 'workspace');
    searchDir(MEMORY_DIR, 'memory');

    if (results.length === 0) {
      return textResult(`No matches found for "${query}"`);
    }
    return textResult(JSON.stringify(results, null, 2));
  },
);

// --- Gateway tools ---

server.tool(
  'claw_ping',
  'Check if the claude-claw gateway daemon is reachable',
  {},
  async () => {
    try {
      const res = await ipcFetch('/status');
      const data = await res.json();
      return textResult(JSON.stringify(data));
    } catch {
      return textResult('Gateway not reachable');
    }
  },
);

// --- Start ---

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
