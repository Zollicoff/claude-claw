import { appendFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { getClawDir } from './config.js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let minLevel: LogLevel = 'info';
let logDir: string | null = null;

export function setLogLevel(level: LogLevel): void {
  minLevel = level;
}

function getLogDir(): string {
  if (!logDir) {
    logDir = join(getClawDir(), 'logs');
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true });
    }
  }
  return logDir;
}

function formatMessage(level: LogLevel, component: string, message: string): string {
  const ts = new Date().toISOString();
  return `${ts} [${level.toUpperCase()}] [${component}] ${message}`;
}

function writeLog(level: LogLevel, component: string, message: string): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return;

  const formatted = formatMessage(level, component, message);

  if (level === 'error') {
    console.error(formatted);
  } else {
    console.log(formatted);
  }

  try {
    const logFile = join(getLogDir(), 'gateway.log');
    appendFileSync(logFile, formatted + '\n');
  } catch {
    // Silently ignore file write errors
  }
}

export function createLogger(component: string) {
  return {
    debug: (msg: string) => writeLog('debug', component, msg),
    info: (msg: string) => writeLog('info', component, msg),
    warn: (msg: string) => writeLog('warn', component, msg),
    error: (msg: string) => writeLog('error', component, msg),
  };
}
