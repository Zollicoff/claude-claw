import { createServer, type Server as HttpServer } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import { createLogger } from '../logger.js';

const log = createLogger('canvas');

const CLIENT_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>claude-claw Canvas</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #0a0a1a;
      color: #e0e0e0;
      font-family: system-ui, -apple-system, sans-serif;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    #header {
      padding: 12px 24px;
      background: #12122a;
      border-bottom: 1px solid #2a2a4a;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    #header h1 { font-size: 16px; color: #8080c0; font-weight: 500; }
    #status { font-size: 12px; color: #606080; }
    #status.connected { color: #40c040; }
    #canvas {
      flex: 1;
      overflow: auto;
      padding: 0;
    }
    #canvas:empty {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    #canvas:empty::after {
      content: 'Waiting for canvas content...';
      color: #404060;
      font-size: 18px;
    }
  </style>
</head>
<body>
  <div id="header">
    <h1>claude-claw Canvas</h1>
    <span id="status">Connecting...</span>
  </div>
  <div id="canvas"></div>
  <script>
    const canvas = document.getElementById('canvas');
    const status = document.getElementById('status');
    let ws;
    let reconnectTimer;

    function connect() {
      ws = new WebSocket('ws://' + location.host);

      ws.onopen = () => {
        status.textContent = 'Connected';
        status.className = 'connected';
        clearTimeout(reconnectTimer);
      };

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === 'update') {
            canvas.innerHTML = data.html;
          } else if (data.type === 'clear') {
            canvas.innerHTML = '';
          }
        } catch (err) {
          console.error('Canvas message error:', err);
        }
      };

      ws.onclose = () => {
        status.textContent = 'Disconnected - reconnecting...';
        status.className = '';
        reconnectTimer = setTimeout(connect, 2000);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();
  </script>
</body>
</html>`;

export class CanvasServer {
  private httpServer: HttpServer | null = null;
  private wss: WebSocketServer | null = null;
  private currentHtml = '';

  start(port: number = 19793, host: string = '127.0.0.1'): void {
    this.httpServer = createServer((req, res) => {
      if (req.url === '/' || req.url === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(CLIENT_HTML);
        return;
      }
      res.writeHead(404);
      res.end();
    });

    this.wss = new WebSocketServer({ server: this.httpServer });

    this.wss.on('connection', (ws: WebSocket) => {
      log.info('Canvas client connected');
      // Send current state to new connections
      if (this.currentHtml) {
        ws.send(JSON.stringify({ type: 'update', html: this.currentHtml }));
      }

      ws.on('close', () => {
        log.info('Canvas client disconnected');
      });
    });

    this.httpServer.listen(port, host, () => {
      log.info(`Canvas server listening on ${host}:${port}`);
    });
  }

  updateCanvas(html: string): void {
    this.currentHtml = html;
    this.broadcast({ type: 'update', html });
    log.info(`Canvas updated (${html.length} bytes)`);
  }

  clearCanvas(): void {
    this.currentHtml = '';
    this.broadcast({ type: 'clear' });
    log.info('Canvas cleared');
  }

  private broadcast(data: unknown): void {
    if (!this.wss) return;
    const msg = JSON.stringify(data);
    for (const client of this.wss.clients) {
      if (client.readyState === 1) {
        client.send(msg);
      }
    }
  }

  stop(): void {
    this.wss?.close();
    this.httpServer?.close();
    log.info('Canvas server stopped');
  }
}
