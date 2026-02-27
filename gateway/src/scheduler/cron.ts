import { readFileSync, writeFileSync, readdirSync, existsSync, unlinkSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import cron from 'node-cron';
import { createLogger } from '../logger.js';
import type { SessionManager, SessionContext } from '../session-manager.js';
import { getClawDir } from '../config.js';

const log = createLogger('cron');

export interface CronJob {
  id: string;
  schedule: string;
  task: string;
  description?: string;
  createdAt: string;
  lastRun?: string;
  lastResult?: string;
}

export class CronScheduler {
  private jobs = new Map<string, cron.ScheduledTask>();
  private jobDefs = new Map<string, CronJob>();
  private sessionManager: SessionManager;
  private cronDir: string;

  constructor(sessionManager: SessionManager) {
    this.sessionManager = sessionManager;
    this.cronDir = join(getClawDir(), 'cron');
    if (!existsSync(this.cronDir)) {
      mkdirSync(this.cronDir, { recursive: true });
    }
  }

  async start(): Promise<void> {
    // Load persisted jobs
    if (!existsSync(this.cronDir)) return;

    const files = readdirSync(this.cronDir).filter((f) => f.endsWith('.json'));
    for (const file of files) {
      try {
        const def = JSON.parse(readFileSync(join(this.cronDir, file), 'utf-8')) as CronJob;
        this.scheduleJob(def);
        log.info(`Loaded cron job: ${def.id} (${def.schedule})`);
      } catch (err) {
        log.error(`Failed to load cron job ${file}: ${err}`);
      }
    }
    log.info(`Loaded ${this.jobs.size} cron jobs`);
  }

  createJob(schedule: string, task: string, description?: string): CronJob {
    if (!cron.validate(schedule)) {
      throw new Error(`Invalid cron schedule: ${schedule}`);
    }

    const job: CronJob = {
      id: randomUUID().slice(0, 8),
      schedule,
      task,
      description,
      createdAt: new Date().toISOString(),
    };

    // Persist to disk
    writeFileSync(join(this.cronDir, `${job.id}.json`), JSON.stringify(job, null, 2));

    // Schedule it
    this.scheduleJob(job);
    log.info(`Created cron job: ${job.id} (${schedule}) - ${task.slice(0, 80)}`);

    return job;
  }

  private scheduleJob(def: CronJob): void {
    const task = cron.schedule(def.schedule, async () => {
      await this.executeJob(def);
    });

    this.jobs.set(def.id, task);
    this.jobDefs.set(def.id, def);
  }

  private async executeJob(def: CronJob): Promise<void> {
    log.info(`Executing cron job: ${def.id} - ${def.task.slice(0, 80)}`);

    const ctx: SessionContext = {
      platform: 'cron',
      channelId: `cron-${def.id}`,
      userId: 'scheduler',
      userName: 'Cron Scheduler',
    };

    try {
      const response = await this.sessionManager.sendMessage(ctx, def.task);
      def.lastRun = new Date().toISOString();
      def.lastResult = response.content.slice(0, 500);
      this.persistJob(def);
      log.info(`Cron job ${def.id} completed`);
    } catch (err) {
      def.lastRun = new Date().toISOString();
      def.lastResult = `Error: ${err}`;
      this.persistJob(def);
      log.error(`Cron job ${def.id} failed: ${err}`);
    }
  }

  private persistJob(def: CronJob): void {
    writeFileSync(join(this.cronDir, `${def.id}.json`), JSON.stringify(def, null, 2));
  }

  deleteJob(id: string): boolean {
    const task = this.jobs.get(id);
    if (!task) return false;

    task.stop();
    this.jobs.delete(id);
    this.jobDefs.delete(id);

    const filePath = join(this.cronDir, `${id}.json`);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }

    log.info(`Deleted cron job: ${id}`);
    return true;
  }

  listJobs(): CronJob[] {
    return [...this.jobDefs.values()];
  }

  async triggerJob(id: string): Promise<string> {
    const def = this.jobDefs.get(id);
    if (!def) throw new Error(`Job not found: ${id}`);
    await this.executeJob(def);
    return def.lastResult || 'No result';
  }

  stop(): void {
    for (const [id, task] of this.jobs) {
      task.stop();
      log.info(`Stopped cron job: ${id}`);
    }
    this.jobs.clear();
  }
}
