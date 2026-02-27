import { createServer, type Server as HttpServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import { randomUUID } from 'node:crypto';
import type { ChannelAdapter, Message, MessageHandler } from './types.js';

const CHAT_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>claude-claw WebChat</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #1a1a2e; color: #e0e0e0; font-family: system-ui, sans-serif; height: 100vh; display: flex; flex-direction: column; }
    #header { padding: 16px 24px; background: #16213e; border-bottom: 1px solid #2a2a4a; }
    #header h1 { font-size: 18px; color: #a0a0d0; }
    #messages { flex: 1; overflow-y: auto; padding: 16px 24px; }
    .msg { margin-bottom: 12px; padding: 8px 12px; border-radius: 8px; max-width: 80%; }
    .msg.user { background: #2a2a4a; margin-left: auto; }
    .msg.bot { background: #16213e; }
    .msg .author { font-size: 12px; color: #888; margin-bottom: 4px; }
    .msg .content { white-space: pre-wrap; line-height: 1.5; }
    #input-area { padding: 16px 24px; background: #16213e; border-top: 1px solid #2a2a4a; display: flex; gap: 12px; }
    #input { flex: 1; background: #1a1a2e; border: 1px solid #2a2a4a; color: #e0e0e0; padding: 12px; border-radius: 8px; font-size: 14px; outline: none; }
    #input:focus { border-color: #4a4a8a; }
    #send { background: #4a4a8a; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 14px; }
    #send:hover { background: #5a5a9a; }
  </style>
</head>
<body>
  <div id="header"><h1>claude-claw WebChat</h1></div>
  <div id="messages"></div>
  <div id="input-area">
    <input id="input" type="text" placeholder="Type a message..." autocomplete="off">
    <button id="send">Send</button>
  </div>
  <script>
    const ws = new WebSocket(\`ws://\${location.host}\`);
    const messages = document.getElementById('messages');
    const input = document.getElementById('input');
    const send = document.getElementById('send');

    function addMessage(author, content, isUser) {
      const div = document.createElement('div');
      div.className = 'msg ' + (isUser ? 'user' : 'bot');
      div.innerHTML = '<div class="author">' + author + '</div><div class="content"></div>';
      div.querySelector('.content').textContent = content;
      messages.appendChild(div);
      messages.scrollTop = messages.scrollHeight;
    }

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'message') {
        addMessage(data.author, data.content, false);
      }
    };

    function sendMsg() {
      const text = input.value.trim();
      if (!text) return;
      addMessage('You', text, true);
      ws.send(JSON.stringify({ type: 'message', content: text }));
      input.value = '';
    }

    send.onclick = sendMsg;
    input.onkeydown = (e) => { if (e.key === 'Enter') sendMsg(); };
  </script>
</body>
</html>`;

export class WebChatAdapter implements ChannelAdapter {
  readonly name = 'webchat';
  private httpServer: HttpServer | null = null;
  private wss: WebSocketServer | null = null;
  private handlers: MessageHandler[] = [];
  private clients = new Map<string, WebSocket>();

  async connect(_config: Record<string, unknown>): Promise<void> {
    const port = 19789; // shares the gateway port via a different path

    this.httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
      if (req.url === '/chat' || req.url === '/chat/') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(CHAT_HTML);
        return;
      }
      res.writeHead(404);
      res.end();
    });

    this.wss = new WebSocketServer({ server: this.httpServer });

    this.wss.on('connection', (ws: WebSocket) => {
      const clientId = randomUUID();
      this.clients.set(clientId, ws);

      ws.on('message', async (data: Buffer) => {
        try {
          const parsed = JSON.parse(data.toString());
          if (parsed.type === 'message' && parsed.content) {
            const message: Message = {
              id: randomUUID(),
              content: parsed.content,
              author: { id: clientId, name: 'WebChat User', platform: 'webchat' },
              channelId: clientId,
              platform: 'webchat',
              timestamp: new Date(),
            };
            for (const handler of this.handlers) {
              await handler(message);
            }
          }
        } catch {
          // ignore invalid messages
        }
      });

      ws.on('close', () => {
        this.clients.delete(clientId);
      });
    });

    // WebChat uses a separate port to avoid conflicting with main API
    this.httpServer.listen(19791, '127.0.0.1', () => {
      console.log('[webchat] WebChat available at http://127.0.0.1:19791/chat');
    });
  }

  async disconnect(): Promise<void> {
    this.wss?.close();
    this.httpServer?.close();
  }

  async sendMessage(channelId: string, content: string): Promise<void> {
    const ws = this.clients.get(channelId);
    if (ws?.readyState === 1) {
      ws.send(JSON.stringify({ type: 'message', author: 'claude-claw', content }));
    }
  }

  onMessage(handler: MessageHandler): void {
    this.handlers.push(handler);
  }

  async getChannels(): Promise<Array<{ id: string; name: string; platform: string }>> {
    return [...this.clients.keys()].map((id) => ({
      id,
      name: `webchat-${id.slice(0, 8)}`,
      platform: 'webchat',
    }));
  }
}
