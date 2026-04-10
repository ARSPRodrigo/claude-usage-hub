import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { DEFAULTS } from '@claude-usage-hub/shared';
import type { CollectorConfig } from '@claude-usage-hub/shared';

/** Resolve ~ to the user's home directory. */
export function expandHome(p: string): string {
  return p.startsWith('~') ? join(homedir(), p.slice(1)) : p;
}

/** Get the collector config directory path. */
export function getConfigDir(): string {
  return expandHome(DEFAULTS.COLLECTOR_CONFIG_DIR);
}

/** Ensure the config directory exists. */
export function ensureConfigDir(): string {
  const dir = getConfigDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/** Get full path to a file in the config directory. */
export function getConfigPath(filename: string): string {
  return join(getConfigDir(), filename);
}

/** Load the collector config. Returns null if not found. */
export function loadConfig(): CollectorConfig | null {
  const configPath = getConfigPath(DEFAULTS.COLLECTOR_CONFIG_FILE);
  if (!existsSync(configPath)) return null;

  try {
    const raw = readFileSync(configPath, 'utf-8');
    return JSON.parse(raw) as CollectorConfig;
  } catch {
    return null;
  }
}

/** Save the collector config. */
export function saveConfig(config: CollectorConfig): void {
  ensureConfigDir();
  const configPath = getConfigPath(DEFAULTS.COLLECTOR_CONFIG_FILE);
  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

const LAST_UPLOAD_FILE = 'last-upload.json';

/** Persist the last successful upload timestamp. */
export function saveLastUploadTime(): void {
  ensureConfigDir();
  writeFileSync(
    getConfigPath(LAST_UPLOAD_FILE),
    JSON.stringify({ timestamp: new Date().toISOString() }),
    'utf-8',
  );
}

/** Get the last successful upload timestamp, or null if never uploaded. */
export function getLastUploadTime(): string | null {
  const p = getConfigPath(LAST_UPLOAD_FILE);
  if (!existsSync(p)) return null;
  try {
    const data = JSON.parse(readFileSync(p, 'utf-8')) as { timestamp: string };
    return data.timestamp;
  } catch {
    return null;
  }
}

/** Generate a default config. developerId is server-assigned; pass it explicitly. */
export function generateDefaultConfig(
  serverUrl: string,
  apiKey: string,
  developerId?: string,
): CollectorConfig {
  return {
    serverUrl,
    apiKey,
    developerId: developerId ?? randomUUID(), // fallback for --skip-check / local mode
    salt: randomBytes(16).toString('hex'),
    intervalMinutes: DEFAULTS.INTERVAL_MINUTES,
    claudeDataPath: DEFAULTS.CLAUDE_DATA_PATH,
  };
}
