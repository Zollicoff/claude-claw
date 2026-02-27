import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createLogger } from '../logger.js';
import type { SessionManager, SessionContext } from '../session-manager.js';

const log = createLogger('heartbeat');

export class HeartbeatDaemon {
  private interval: ReturnType<typeof setInterval> | null = null;
  private sessionManager: SessionManager;
  private workspacePath: string;
  private intervalMs: number;

  constructor(sessionManager: SessionManager, workspacePath: string, intervalMs: number) {
    this.sessionManager = sessionManager;
    this.workspacePath = workspacePath;
    this.intervalMs = intervalMs;
  }

  start(): void {
    const heartbeatPath = join(this.workspacePath, 'HEARTBEAT.md');

    if (!existsSync(heartbeatPath)) {
      log.info('No HEARTBEAT.md found, heartbeat daemon inactive');
      return;
    }

    log.info(`Heartbeat daemon starting (interval: ${this.intervalMs / 1000}s)`);

    this.interval = setInterval(async () => {
      await this.beat();
    }, this.intervalMs);

    // Also run immediately on start
    this.beat().catch((err) => log.error(`Initial heartbeat failed: ${err}`));
  }

  private async beat(): Promise<void> {
    const heartbeatPath = join(this.workspacePath, 'HEARTBEAT.md');

    if (!existsSync(heartbeatPath)) {
      log.info('HEARTBEAT.md removed, skipping beat');
      return;
    }

    const checklist = readFileSync(heartbeatPath, 'utf-8').trim();
    if (!checklist) {
      log.info('HEARTBEAT.md is empty, skipping beat');
      return;
    }

    log.info('Running heartbeat...');

    const ctx: SessionContext = {
      platform: 'heartbeat',
      channelId: 'heartbeat',
      userId: 'scheduler',
      userName: 'Heartbeat Daemon',
    };

    const systemMessage = [
      'You are running a heartbeat check. Review the checklist below and take action on any items that need attention.',
      'If everything is fine, respond with HEARTBEAT_OK.',
      'If you take any actions, summarize what you did.',
      '',
      '---',
      '',
      checklist,
    ].join('\n');

    try {
      const response = await this.sessionManager.sendMessage(ctx, systemMessage);
      if (response.content.includes('HEARTBEAT_OK')) {
        log.info('Heartbeat: OK');
      } else {
        log.info(`Heartbeat: actions taken - ${response.content.slice(0, 200)}`);
      }
    } catch (err) {
      log.error(`Heartbeat failed: ${err}`);
    }
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      log.info('Heartbeat daemon stopped');
    }
  }
}
