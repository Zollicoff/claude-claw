import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createLogger } from '../logger.js';
import type { SessionManager, SessionContext } from '../session-manager.js';
import { getClawDir } from '../config.js';

const log = createLogger('webhooks');

interface WebhookConfig {
  id: string;
  token: string;
  description: string;
  template?: string;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

export class WebhookHandler {
  private sessionManager: SessionManager;
  private webhooks = new Map<string, WebhookConfig>();

  constructor(sessionManager: SessionManager) {
    this.sessionManager = sessionManager;
    this.loadWebhooks();
  }

  private loadWebhooks(): void {
    const configPath = join(getClawDir(), 'config.json');
    if (!existsSync(configPath)) return;

    try {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      const webhooks = config.webhooks || [];
      for (const wh of webhooks) {
        if (wh.id && wh.token) {
          this.webhooks.set(wh.id, wh);
        }
      }
      if (this.webhooks.size > 0) {
        log.info(`Loaded ${this.webhooks.size} webhook configurations`);
      }
    } catch {
      // Config may not have webhooks yet
    }
  }

  async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = req.url || '';
    const match = url.match(/^\/webhooks\/([^/?]+)/);
    if (!match) return false;

    const webhookId = match[1];
    const webhook = this.webhooks.get(webhookId);

    if (!webhook) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Webhook not found' }));
      return true;
    }

    // Validate token
    const authHeader = req.headers.authorization;
    const queryToken = new URL(url, 'http://localhost').searchParams.get('token');
    const providedToken = authHeader?.replace('Bearer ', '') || queryToken;

    if (providedToken !== webhook.token) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return true;
    }

    // Process the webhook
    try {
      const body = await readBody(req);
      const payload = body ? JSON.parse(body) : {};

      const ctx: SessionContext = {
        platform: 'webhook',
        channelId: `webhook-${webhookId}`,
        userId: 'webhook',
        userName: `Webhook: ${webhook.description}`,
      };

      const message = webhook.template
        ? webhook.template.replace('{{payload}}', JSON.stringify(payload, null, 2))
        : `Webhook "${webhook.description}" triggered with payload:\n\n${JSON.stringify(payload, null, 2)}`;

      log.info(`Webhook ${webhookId} triggered`);
      const response = await this.sessionManager.sendMessage(ctx, message);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ result: response.content }));
    } catch (err) {
      log.error(`Webhook ${webhookId} error: ${err}`);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: String(err) }));
    }

    return true;
  }
}
