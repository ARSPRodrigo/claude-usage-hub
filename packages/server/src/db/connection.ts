import { chmodSync } from 'node:fs';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';

export type DB = BetterSQLite3Database<typeof schema>;

let dbInstance: DB | null = null;
let rawDb: Database.Database | null = null;

/**
 * Create and configure a SQLite database connection.
 * Enables WAL mode for concurrent read performance.
 */
export function createDb(dbPath: string): { db: DB; raw: Database.Database } {
  const sqlite = new Database(dbPath);

  // Restrict file permissions to owner only (0600)
  try { chmodSync(dbPath, 0o600); } catch { /* may fail on Windows */ }

  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('busy_timeout = 5000');
  sqlite.pragma('synchronous = NORMAL');
  sqlite.pragma('foreign_keys = ON');

  const db = drizzle(sqlite, { schema });

  rawDb = sqlite;
  dbInstance = db;

  return { db, raw: sqlite };
}

/** Get the singleton Drizzle DB instance. */
export function getDb(): DB {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call createDb() first.');
  }
  return dbInstance;
}

/** Get the raw better-sqlite3 instance. */
export function getRawDb(): Database.Database {
  if (!rawDb) {
    throw new Error('Database not initialized. Call createDb() first.');
  }
  return rawDb;
}

/** Close the database connection. */
export function closeDb(): void {
  if (rawDb) {
    rawDb.close();
    rawDb = null;
    dbInstance = null;
  }
}
