import { homedir } from 'node:os';
import { join } from 'node:path';
import { SERVER_DEFAULTS } from '@claude-usage-hub/shared';
import type { ServerConfig, AppMode } from '@claude-usage-hub/shared';

function expandHome(p: string): string {
  return p.startsWith('~') ? join(homedir(), p.slice(1)) : p;
}

/**
 * Load server configuration from environment variables with defaults.
 */
export function loadServerConfig(overrides?: Partial<ServerConfig>): ServerConfig {
  return {
    mode: (overrides?.mode ?? process.env['MODE'] ?? SERVER_DEFAULTS.MODE) as AppMode,
    port: overrides?.port ?? parseInt(process.env['PORT'] ?? String(SERVER_DEFAULTS.PORT), 10),
    dbPath: expandHome(
      overrides?.dbPath ?? process.env['DB_PATH'] ?? SERVER_DEFAULTS.DB_PATH,
    ),
    retentionDays:
      overrides?.retentionDays ??
      parseInt(process.env['RETENTION_DAYS'] ?? String(SERVER_DEFAULTS.RETENTION_DAYS), 10),
    dashboardDistPath: overrides?.dashboardDistPath,
  };
}
