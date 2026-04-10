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
     VALUES (?, ?, ?, 'admin', ?, ?)`,
  ).run(id, email, 'Admin', developerId, passwordHash);

  console.log(`Admin user created: ${email}`);
}
