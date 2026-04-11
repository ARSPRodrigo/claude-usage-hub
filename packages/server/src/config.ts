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

/** Auth configuration for team mode. */
export interface AuthConfig {
  jwtSecret: string;
  adminEmail: string;
  adminPassword: string;
  googleClientId: string;
  allowedDomain: string;
}

/**
 * Load auth configuration from environment variables.
 * Throws if JWT_SECRET is missing or still the placeholder value.
 */
export function loadAuthConfig(): AuthConfig {
  const jwtSecret = process.env['JWT_SECRET'];
  if (!jwtSecret || jwtSecret === 'change-me-to-a-random-string' || jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be set to a secure random string of at least 32 characters in team mode');
  }
  return {
    jwtSecret,
    adminEmail: process.env['ADMIN_EMAIL'] ?? '',
    adminPassword: process.env['ADMIN_PASSWORD'] ?? '',
    googleClientId: process.env['GOOGLE_CLIENT_ID'] ?? '',
    allowedDomain: process.env['ALLOWED_DOMAIN'] ?? '',
  };
}
