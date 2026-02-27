import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, type ClawConfig } from './config.js';
import { createLogger } from './logger.js';
import { SessionManager, type SessionContext } from './session-manager.js';
import { createIpcServer, type IpcHandlers } from './ipc.js';
import type { ChannelAdapter, Message, MessageHandler } from './adapters/types.js';
import { CronScheduler } from './scheduler/cron.js';
import { HeartbeatDaemon } from './scheduler/heartbeat.js';
import { WebhookHandler } from './scheduler/webhooks.js';
import { CanvasServer } from './canvas/server.js';

const log = createLogger('gateway');
const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_DIR = resolve(__dirname, '..', '..');

// --- State ---
let config: ClawConfig;
let sessionManager: SessionManager;
let cronScheduler: CronScheduler;
let heartbeatDaemon: HeartbeatDaemon;
let webhookHandler: WebhookHandler;
let canvasServer: CanvasServer;
const adapters = new Map<string, ChannelAdapter>();
const startTime = Date.now();

// --- Helpers ---
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function jsonResponse(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// --- Message routing ---
async function handleIncomingMessage(message: Message): Promise<string> {
  const ctx: SessionContext = {
    platform: message.platform,
    channelId: message.channelId,
    userId: message.author.id,
    userName: message.author.name,
  };

  const response = await sessionManager.sendMessage(ctx, message.content);
  return response.content;
}

const onMessage: MessageHandler = async (message: Message) => {
  log.info(`[${message.platform}] ${message.author.name}: ${message.content.slice(0, 100)}`);
  try {
    const response = await handleIncomingMessage(message);
    const adapter = adapters.get(message.platform);
    if (adapter) {
      await adapter.sendMessage(message.channelId, response);
    }
    log.info(`[${message.platform}] Response sent to ${message.channelId}`);
  } catch (err) {
    log.error(`Failed to handle message: ${err}`);
  }
};

// --- IPC handlers (for MCP bridge) ---
const ipcHandlers: IpcHandlers = {
  sendMessage: async (platform: string, channel: string, message: string) => {
    const adapter = adapters.get(platform);
    if (!adapter) throw new Error(`No adapter for platform: ${platform}`);
    await adapter.sendMessage(channel, message);
  },
  getChannels: async () => {
    const all: Array<{ id: string; name: string; platform: string }> = [];
    for (const [, adapter] of adapters) {
      const channels = await adapter.getChannels();
      all.push(...channels);
    }
    return all;
  },
  getHistory: async (_platform: string, _channel: string, _limit: number) => {
    // TODO: Implement history storage
    return [];
  },
  canvasUpdate: async (html: string) => {
    canvasServer.updateCanvas(html);
  },
  canvasClear: async () => {
    canvasServer.clearCanvas();
  },
};

// --- Adapter loading ---
async function loadAdapters(): Promise<void> {
  const adapterConfig = config.adapters;

  if (adapterConfig.discord?.token) {
    try {
      const { DiscordAdapter } = await import('./adapters/discord.js');
      const discord = new DiscordAdapter();
      discord.onMessage(onMessage);
      await discord.connect(adapterConfig.discord);
      adapters.set('discord', discord);
      log.info('Discord adapter connected');
    } catch (err) {
      log.error(`Failed to load Discord adapter: ${err}`);
    }
  }

  if (adapterConfig.telegram?.token) {
    try {
      const { TelegramAdapter } = await import('./adapters/telegram.js');
      const telegram = new TelegramAdapter();
      telegram.onMessage(onMessage);
      await telegram.connect(adapterConfig.telegram);
      adapters.set('telegram', telegram);
      log.info('Telegram adapter connected');
    } catch (err) {
      log.error(`Failed to load Telegram adapter: ${err}`);
    }
  }

  if (adapterConfig.webchat?.enabled) {
    try {
      const { WebChatAdapter } = await import('./adapters/webchat.js');
      const webchat = new WebChatAdapter();
      webchat.onMessage(onMessage);
      await webchat.connect(adapterConfig.webchat);
      adapters.set('webchat', webchat);
      log.info('WebChat adapter connected');
    } catch (err) {
      log.error(`Failed to load WebChat adapter: ${err}`);
    }
  }
}

// --- Public HTTP API ---
const apiServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  try {
    // Handle webhook requests first
    if (req.url?.startsWith('/webhooks/')) {
      const handled = await webhookHandler.handleRequest(req, res);
      if (handled) return;
    }

    // GET /api/status
    if (req.method === 'GET' && req.url === '/api/status') {
      jsonResponse(res, 200, {
        status: 'running',
        version: '0.1.0',
        uptime: Math.floor((Date.now() - startTime) / 1000),
        adapters: [...adapters.keys()],
        sessions: sessionManager.getActiveSessions().length,
        cronJobs: cronScheduler.listJobs().length,
      });
      return;
    }

    // GET /api/sessions
    if (req.method === 'GET' && req.url === '/api/sessions') {
      jsonResponse(res, 200, { sessions: sessionManager.getActiveSessions() });
      return;
    }

    // GET /api/channels
    if (req.method === 'GET' && req.url === '/api/channels') {
      const channels = await ipcHandlers.getChannels();
      jsonResponse(res, 200, { channels });
      return;
    }

    // POST /api/message (test endpoint)
    if (req.method === 'POST' && req.url === '/api/message') {
      const body = JSON.parse(await readBody(req));
      const { message, channelId, userId, userName, platform } = body;
      if (!message) {
        jsonResponse(res, 400, { error: 'message is required' });
        return;
      }
      const msg: Message = {
        id: crypto.randomUUID(),
        content: message,
        author: {
          id: userId || 'api-user',
          name: userName || 'API User',
          platform: platform || 'api',
        },
        channelId: channelId || 'api-test',
        platform: platform || 'api',
        timestamp: new Date(),
      };
      const response = await handleIncomingMessage(msg);
      jsonResponse(res, 200, { response });
      return;
    }

    // POST /api/send (send message to a specific adapter channel)
    if (req.method === 'POST' && req.url === '/api/send') {
      const body = JSON.parse(await readBody(req));
      const { platform, channel, message } = body;
      if (!platform || !channel || !message) {
        jsonResponse(res, 400, { error: 'platform, channel, and message are required' });
        return;
      }
      await ipcHandlers.sendMessage(platform, channel, message);
      jsonResponse(res, 200, { sent: true });
      return;
    }

    // GET /api/cron
    if (req.method === 'GET' && req.url === '/api/cron') {
      jsonResponse(res, 200, { jobs: cronScheduler.listJobs() });
      return;
    }

    // POST /api/cron
    if (req.method === 'POST' && req.url === '/api/cron') {
      const body = JSON.parse(await readBody(req));
      const { schedule, task, description } = body;
      if (!schedule || !task) {
        jsonResponse(res, 400, { error: 'schedule and task are required' });
        return;
      }
      const job = cronScheduler.createJob(schedule, task, description);
      jsonResponse(res, 201, { job });
      return;
    }

    // DELETE /api/cron/:id
    if (req.method === 'DELETE' && req.url?.startsWith('/api/cron/')) {
      const id = req.url.split('/').pop()!;
      const deleted = cronScheduler.deleteJob(id);
      if (deleted) {
        jsonResponse(res, 200, { deleted: true });
      } else {
        jsonResponse(res, 404, { error: 'Job not found' });
      }
      return;
    }

    // POST /api/cron/:id/trigger
    if (req.method === 'POST' && req.url?.match(/^\/api\/cron\/[^/]+\/trigger$/)) {
      const id = req.url.split('/')[3];
      const result = await cronScheduler.triggerJob(id);
      jsonResponse(res, 200, { result });
      return;
    }

    // POST /api/shutdown
    if (req.method === 'POST' && req.url === '/api/shutdown') {
      log.info('Shutdown requested');
      jsonResponse(res, 200, { status: 'shutting_down' });
      await shutdown();
      return;
    }

    jsonResponse(res, 404, { error: 'Not found' });
  } catch (err) {
    log.error(`API error: ${err}`);
    jsonResponse(res, 500, { error: String(err) });
  }
});

// --- Lifecycle ---
async function shutdown(): Promise<void> {
  log.info('Shutting down...');
  cronScheduler.stop();
  heartbeatDaemon.stop();
  canvasServer.stop();
  for (const [name, adapter] of adapters) {
    try {
      await adapter.disconnect();
      log.info(`Disconnected ${name}`);
    } catch (err) {
      log.error(`Error disconnecting ${name}: ${err}`);
    }
  }
  process.exit(0);
}

async function main(): Promise<void> {
  log.info('Starting claude-claw gateway...');

  config = loadConfig();
  sessionManager = new SessionManager(config, PLUGIN_DIR);

  // Start IPC server for MCP bridge
  createIpcServer(config.ipc.port, ipcHandlers);

  // Load platform adapters
  await loadAdapters();

  // Start canvas server
  canvasServer = new CanvasServer();
  canvasServer.start(config.canvas.port, config.gateway.host);

  // Initialize scheduler
  cronScheduler = new CronScheduler(sessionManager);
  await cronScheduler.start();
  webhookHandler = new WebhookHandler(sessionManager);
  heartbeatDaemon = new HeartbeatDaemon(
    sessionManager,
    config.workspace,
    config.heartbeat.intervalMs,
  );
  if (config.heartbeat.enabled) {
    heartbeatDaemon.start();
  }

  // Start public API
  apiServer.listen(config.gateway.port, config.gateway.host, () => {
    log.info(`Gateway API listening on ${config.gateway.host}:${config.gateway.port}`);
    log.info(`Adapters: ${[...adapters.keys()].join(', ') || 'none'}`);
  });

  // Session cleanup every 5 minutes
  setInterval(() => sessionManager.cleanupIdleSessions(), 5 * 60 * 1000);

  // Graceful shutdown
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  log.error(`Fatal: ${err}`);
  process.exit(1);
});
