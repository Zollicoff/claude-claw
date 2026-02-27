import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export interface AdapterConfig {
  discord?: { token: string; allowedChannels?: string[] };
  telegram?: { token: string; allowedChats?: string[] };
  slack?: { token: string; appToken: string };
  webchat?: { enabled: boolean };
}

export interface ClawConfig {
  gateway: {
    port: number;
    host: string;
  };
  ipc: {
    port: number;
  };
  canvas: {
    port: number;
  };
  adapters: AdapterConfig;
  session: {
    timeoutMs: number;
    maxConcurrent: number;
    permissionMode: string;
    model?: string;
  };
  heartbeat: {
    enabled: boolean;
    intervalMs: number;
  };
  workspace: string;
}

const CLAW_DIR = join(homedir(), '.claude-claw');

const DEFAULTS: ClawConfig = {
  gateway: { port: 19789, host: '127.0.0.1' },
  ipc: { port: 19790 },
  canvas: { port: 19793 },
  adapters: {},
  session: {
    timeoutMs: 120_000,
    maxConcurrent: 5,
    permissionMode: 'bypassPermissions',
  },
  heartbeat: {
    enabled: false,
    intervalMs: 30 * 60 * 1000,
  },
  workspace: join(CLAW_DIR, 'workspace'),
};

const SUBDIRS = ['workspace', 'sessions', 'memory', 'cron', 'logs'];

export function getClawDir(): string {
  return CLAW_DIR;
}

export function ensureDirectories(): void {
  if (!existsSync(CLAW_DIR)) {
    mkdirSync(CLAW_DIR, { recursive: true });
  }
  for (const sub of SUBDIRS) {
    const dir = join(CLAW_DIR, sub);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}

export function loadConfig(): ClawConfig {
  ensureDirectories();

  const configPath = join(CLAW_DIR, 'config.json');

  if (!existsSync(configPath)) {
    writeFileSync(configPath, JSON.stringify(DEFAULTS, null, 2));
    chmodSync(configPath, 0o600);
    return { ...DEFAULTS };
  }

  const raw = JSON.parse(readFileSync(configPath, 'utf-8'));
  return {
    gateway: { ...DEFAULTS.gateway, ...raw.gateway },
    ipc: { ...DEFAULTS.ipc, ...raw.ipc },
    canvas: { ...DEFAULTS.canvas, ...raw.canvas },
    adapters: raw.adapters ?? DEFAULTS.adapters,
    session: { ...DEFAULTS.session, ...raw.session },
    heartbeat: { ...DEFAULTS.heartbeat, ...raw.heartbeat },
    workspace: raw.workspace ?? DEFAULTS.workspace,
  };
}

export function saveConfig(config: ClawConfig): void {
  const configPath = join(CLAW_DIR, 'config.json');
  writeFileSync(configPath, JSON.stringify(config, null, 2));
  chmodSync(configPath, 0o600);
}
