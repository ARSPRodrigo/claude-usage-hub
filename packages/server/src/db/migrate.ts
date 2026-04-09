import type Database from 'better-sqlite3';

/**
 * Run database migrations.
 *
 * Uses plain SQL CREATE TABLE IF NOT EXISTS for simplicity.
 * Drizzle is used for typed queries, not for migrations in alpha.
 */
export function runMigrations(raw: Database.Database): void {
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
  `);
}
