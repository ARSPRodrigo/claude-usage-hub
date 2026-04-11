import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { AppMode } from '@claude-usage-hub/shared';
import { hashPassword } from '../services/auth-utils.js';

/**
 * Run database migrations.
 *
 * Uses plain SQL CREATE TABLE IF NOT EXISTS for simplicity.
 * Drizzle is used for typed queries, not for migrations in alpha.
 */
export function runMigrations(raw: Database.Database, mode?: AppMode): void {
  raw.exec(`
    CREATE TABLE IF NOT EXISTS usage_entries (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id            TEXT NOT NULL,
      message_id            TEXT NOT NULL,
      request_id            TEXT NOT NULL,
      timestamp             TEXT NOT NULL,
      model                 TEXT NOT NULL,
      input_tokens          INTEGER NOT NULL,
      output_tokens         INTEGER NOT NULL,
      cache_creation_tokens INTEGER NOT NULL,
      cache_read_tokens     INTEGER NOT NULL,
      service_tier          TEXT NOT NULL DEFAULT 'standard',
      developer_id          TEXT NOT NULL,
      project_alias         TEXT NOT NULL,
      cost_usd              REAL NOT NULL,
      created_at            TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_message_request
      ON usage_entries(message_id, request_id);

    CREATE INDEX IF NOT EXISTS idx_timestamp
      ON usage_entries(timestamp);

    CREATE INDEX IF NOT EXISTS idx_session_id
      ON usage_entries(session_id);

    CREATE INDEX IF NOT EXISTS idx_project_alias
      ON usage_entries(project_alias);

    CREATE INDEX IF NOT EXISTS idx_model
      ON usage_entries(model);

    CREATE INDEX IF NOT EXISTS idx_timestamp_model
      ON usage_entries(timestamp, model);

    -- Auth tables (team mode)
    CREATE TABLE IF NOT EXISTS users (
      id             TEXT PRIMARY KEY,
      email          TEXT NOT NULL UNIQUE,
      display_name   TEXT NOT NULL,
      role           TEXT NOT NULL DEFAULT 'developer',
      developer_id   TEXT NOT NULL UNIQUE,
      password_hash  TEXT NOT NULL,
      created_at     TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at     TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id             TEXT PRIMARY KEY,
      user_id        TEXT NOT NULL REFERENCES users(id),
      key_prefix     TEXT NOT NULL,
      key_hash       TEXT NOT NULL UNIQUE,
      label          TEXT NOT NULL,
      developer_id   TEXT NOT NULL,
      created_at     TEXT DEFAULT CURRENT_TIMESTAMP,
      revoked_at     TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_api_keys_hash
      ON api_keys(key_hash);

    CREATE INDEX IF NOT EXISTS idx_api_keys_user
      ON api_keys(user_id);
  `);

  // Incremental migrations — wrapped in try/catch since SQLite has no IF NOT EXISTS for columns
  try {
    raw.exec(`ALTER TABLE users ADD COLUMN google_id TEXT`);
    raw.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL`);
  } catch {
    // Column already exists from a previous run — safe to ignore
  }

  try {
    raw.exec(`ALTER TABLE invitations ADD COLUMN role TEXT NOT NULL DEFAULT 'developer'`);
  } catch {
    // Column already exists — safe to ignore
  }

  try {
    raw.exec(`ALTER TABLE api_keys ADD COLUMN last_used_at TEXT`);
  } catch {
    // Column already exists — safe to ignore
  }

  try {
    raw.exec(`ALTER TABLE usage_entries ADD COLUMN api_key_id TEXT`);
    raw.exec(`CREATE INDEX IF NOT EXISTS idx_usage_api_key_id ON usage_entries(api_key_id)`);
  } catch {
    // Column already exists — safe to ignore
  }

  // Invitations table (C5)
  raw.exec(`
    CREATE TABLE IF NOT EXISTS invitations (
      id           TEXT PRIMARY KEY,
      email        TEXT NOT NULL,
      token_hash   TEXT NOT NULL UNIQUE,
      invited_by   TEXT NOT NULL REFERENCES users(id),
      created_at   TEXT DEFAULT CURRENT_TIMESTAMP,
      expires_at   TEXT NOT NULL,
      accepted_at  TEXT,
      role         TEXT NOT NULL DEFAULT 'developer'
    );

    CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token_hash);
    CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);
  `);

  if (mode === 'team') {
    bootstrapAdmin(raw);
  }
}

/**
 * Create the initial admin user from environment variables if none exists.
 */
function bootstrapAdmin(raw: Database.Database): void {
  const email = process.env['ADMIN_EMAIL'];
  const password = process.env['ADMIN_PASSWORD'];

  if (!email || !password) {
    console.log('ADMIN_EMAIL/ADMIN_PASSWORD not set — skipping admin bootstrap');
    return;
  }

  const existing = raw.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return;
  }

  const id = randomUUID();
  const passwordHash = hashPassword(password);
  const developerId = `admin-${id.slice(0, 8)}`;

  raw.prepare(
    `INSERT INTO users (id, email, display_name, role, developer_id, password_hash)
     VALUES (?, ?, ?, 'primary_owner', ?, ?)`,
  ).run(id, email, 'Primary Owner', developerId, passwordHash);

  console.log(`Primary owner created: ${email}`);
}
