import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createLogger } from './logger.js';

const log = createLogger('ipc');

type SendMessageHandler = (platform: string, channel: string, message: string) => Promise<void>;
type GetChannelsHandler = () => Promise<Array<{ id: string; name: string; platform: string }>>;
type GetHistoryHandler = (platform: string, channel: string, limit: number) => Promise<Array<{ author: string; content: string; timestamp: string }>>;
type CanvasUpdateHandler = (html: string) => Promise<void>;
type CanvasClearHandler = () => Promise<void>;

export interface IpcHandlers {
  sendMessage: SendMessageHandler;
  getChannels: GetChannelsHandler;
  getHistory: GetHistoryHandler;
  canvasUpdate: CanvasUpdateHandler;
  canvasClear: CanvasClearHandler;
}

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

export function createIpcServer(port: number, handlers: IpcHandlers): ReturnType<typeof createServer> {
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      // GET /status
      if (req.method === 'GET' && req.url === '/status') {
        jsonResponse(res, 200, { status: 'ok', ipc: true });
        return;
      }

      // GET /channels
      if (req.method === 'GET' && req.url === '/channels') {
        const channels = await handlers.getChannels();
        jsonResponse(res, 200, { channels });
        return;
      }

      // GET /history?platform=...&channel=...&limit=...
      if (req.method === 'GET' && req.url?.startsWith('/history')) {
        const url = new URL(req.url, `http://localhost:${port}`);
        const platform = url.searchParams.get('platform') || '';
        const channel = url.searchParams.get('channel') || '';
        const limit = parseInt(url.searchParams.get('limit') || '50', 10);
        const history = await handlers.getHistory(platform, channel, limit);
        jsonResponse(res, 200, { history });
        return;
      }

      // POST /send-message
      if (req.method === 'POST' && req.url === '/send-message') {
        const body = JSON.parse(await readBody(req));
        await handlers.sendMessage(body.platform, body.channel, body.message);
        jsonResponse(res, 200, { sent: true });
        return;
      }

      // POST /canvas
      if (req.method === 'POST' && req.url === '/canvas') {
        const body = JSON.parse(await readBody(req));
        if (body.html) {
          await handlers.canvasUpdate(body.html);
        } else {
          await handlers.canvasClear();
        }
        jsonResponse(res, 200, { updated: true });
        return;
      }

      jsonResponse(res, 404, { error: 'Not found' });
    } catch (err) {
      log.error(`IPC error: ${err}`);
      jsonResponse(res, 500, { error: String(err) });
    }
  });

  server.listen(port, '127.0.0.1', () => {
    log.info(`IPC server started on 127.0.0.1:${port}`);
  });

  return server;
}
