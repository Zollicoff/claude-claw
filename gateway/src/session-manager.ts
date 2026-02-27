import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ClawConfig } from './config.js';
import { createLogger } from './logger.js';

const log = createLogger('session-manager');

export interface SessionContext {
  platform: string;
  channelId: string;
  userId: string;
  userName: string;
}

export interface SessionResponse {
  content: string;
  sessionId: string;
}

interface ActiveSession {
  sessionId: string;
  lastActive: Date;
}

export class SessionManager {
  private sessions = new Map<string, ActiveSession>();
  private activeCalls = 0;
  private config: ClawConfig;
  private pluginDir: string;

  constructor(config: ClawConfig, pluginDir: string) {
    this.config = config;
    this.pluginDir = pluginDir;
  }

  private sessionKey(ctx: SessionContext): string {
    return `${ctx.platform}:${ctx.channelId}:${ctx.userId}`;
  }

  private getOrCreateSession(ctx: SessionContext): string {
    const key = this.sessionKey(ctx);
    const existing = this.sessions.get(key);
    if (existing) {
      existing.lastActive = new Date();
      return existing.sessionId;
    }
    const sessionId = randomUUID();
    this.sessions.set(key, { sessionId, lastActive: new Date() });
    return sessionId;
  }

  private buildSystemPrompt(ctx: SessionContext): string {
    const parts: string[] = [];
    const ws = this.config.workspace;

    const files = ['IDENTITY.md', 'SOUL.md', 'AGENTS.md', 'USER.md', 'MEMORY.md'];
    for (const file of files) {
      const path = join(ws, file);
      if (existsSync(path)) {
        const content = readFileSync(path, 'utf-8').trim();
        if (content) {
          parts.push(`## ${file}\n${content}`);
        }
      }
    }

    parts.push(`## Context`);
    parts.push(`Platform: ${ctx.platform}`);
    parts.push(`Channel: ${ctx.channelId}`);
    parts.push(`User: ${ctx.userName} (${ctx.userId})`);
    parts.push(`You are responding to a message on ${ctx.platform}. Keep responses concise and conversational for chat context.`);
    parts.push(`You have access to claw-bridge MCP tools: send_message, get_channels, get_history, canvas_update, canvas_clear, memory_read, memory_write, memory_search.`);

    return parts.join('\n\n');
  }

  async sendMessage(ctx: SessionContext, message: string): Promise<SessionResponse> {
    if (this.activeCalls >= this.config.session.maxConcurrent) {
      throw new Error('Max concurrent sessions reached');
    }

    const sessionId = this.getOrCreateSession(ctx);
    this.activeCalls++;

    try {
      const content = await this.spawnClaude(sessionId, ctx, message);
      return { content, sessionId };
    } finally {
      this.activeCalls--;
    }
  }

  private spawnClaude(sessionId: string, ctx: SessionContext, message: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const systemPrompt = this.buildSystemPrompt(ctx);
      const mcpConfig = join(this.pluginDir, '.mcp.json');

      const args = [
        '--print',
        '--output-format', 'text',
        '--session-id', sessionId,
        '--permission-mode', this.config.session.permissionMode,
        '--no-session-persistence',
      ];

      if (existsSync(mcpConfig)) {
        args.push('--mcp-config', mcpConfig);
      }

      if (systemPrompt) {
        args.push('--system-prompt', systemPrompt);
      }

      if (this.config.session.model) {
        args.push('--model', this.config.session.model);
      }

      args.push(message);

      log.info(`Spawning claude session ${sessionId} for ${ctx.platform}:${ctx.channelId}`);

      const child = spawn('claude', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          CLAW_GATEWAY_IPC: `http://127.0.0.1:${this.config.ipc.port}`,
        },
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      const timeout = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`Session timed out after ${this.config.session.timeoutMs}ms`));
      }, this.config.session.timeoutMs);

      child.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          const content = stdout.trim();
          if (!content) {
            resolve('(No response)');
          } else {
            resolve(content);
          }
        } else {
          log.error(`Claude exited with code ${code}: ${stderr}`);
          reject(new Error(`Claude exited with code ${code}: ${stderr.slice(0, 500)}`));
        }
      });

      child.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  getActiveSessions(): Array<{ key: string; sessionId: string; lastActive: string }> {
    const result: Array<{ key: string; sessionId: string; lastActive: string }> = [];
    for (const [key, session] of this.sessions) {
      result.push({
        key,
        sessionId: session.sessionId,
        lastActive: session.lastActive.toISOString(),
      });
    }
    return result;
  }

  cleanupIdleSessions(maxIdleMs: number = 30 * 60 * 1000): number {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, session] of this.sessions) {
      if (now - session.lastActive.getTime() > maxIdleMs) {
        this.sessions.delete(key);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      log.info(`Cleaned up ${cleaned} idle sessions`);
    }
    return cleaned;
  }
}
