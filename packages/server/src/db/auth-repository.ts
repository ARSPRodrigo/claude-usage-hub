import { getRawDb } from './connection.js';

/** Raw database row shape for users table. */
export interface UserRow {
  id: string;
  email: string;
  display_name: string;
  role: string;
  developer_id: string;
  password_hash: string;  // empty string for Google-auth users
  google_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Raw database row shape for api_keys table (excludes key_hash for list queries). */
export interface ApiKeyRow {
  id: string;
  user_id: string;
  key_prefix: string;
  key_hash: string;
  label: string;
  developer_id: string;
  created_at: string;
  revoked_at: string | null;
}

export function findUserByEmail(email: string): UserRow | null {
  const db = getRawDb();
  return (db.prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRow) ?? null;
}

export function findUserById(id: string): UserRow | null {
  const db = getRawDb();
  return (db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow) ?? null;
}

export function findUserByGoogleId(googleId: string): UserRow | null {
  const db = getRawDb();
  return (db.prepare('SELECT * FROM users WHERE google_id = ?').get(googleId) as UserRow) ?? null;
}

export function createUser(user: {
  id: string;
  email: string;
  displayName: string;
  role: string;
  developerId: string;
  passwordHash?: string;
  googleId?: string;
}): void {
  const db = getRawDb();
  db.prepare(
    `INSERT INTO users (id, email, display_name, role, developer_id, password_hash, google_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    user.id,
    user.email,
    user.displayName,
    user.role,
    user.developerId,
    user.passwordHash ?? '',
    user.googleId ?? null,
  );
}

export function updateUserGoogleId(userId: string, googleId: string): void {
  const db = getRawDb();
  db.prepare("UPDATE users SET google_id = ?, updated_at = datetime('now') WHERE id = ?")
    .run(googleId, userId);
}

export function listUsers(): Omit<UserRow, 'password_hash'>[] {
  const db = getRawDb();
  return db
    .prepare(
      'SELECT id, email, display_name, role, developer_id, created_at, updated_at FROM users ORDER BY created_at',
    )
    .all() as Omit<UserRow, 'password_hash'>[];
}

export function findApiKeyByHash(keyHash: string): ApiKeyRow | null {
  const db = getRawDb();
  return (
    (db
      .prepare('SELECT * FROM api_keys WHERE key_hash = ? AND revoked_at IS NULL')
      .get(keyHash) as ApiKeyRow) ?? null
  );
}

export function createApiKey(apiKey: {
  id: string;
  userId: string;
  keyPrefix: string;
  keyHash: string;
  label: string;
  developerId: string;
}): void {
  const db = getRawDb();
  db.prepare(
    `INSERT INTO api_keys (id, user_id, key_prefix, key_hash, label, developer_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(apiKey.id, apiKey.userId, apiKey.keyPrefix, apiKey.keyHash, apiKey.label, apiKey.developerId);
}

export function listApiKeys(): Omit<ApiKeyRow, 'key_hash'>[] {
  const db = getRawDb();
  return db
    .prepare(
      `SELECT id, user_id, key_prefix, label, developer_id, created_at, revoked_at
       FROM api_keys ORDER BY created_at DESC`,
    )
    .all() as Omit<ApiKeyRow, 'key_hash'>[];
}

export function listApiKeysForUser(userId: string): Omit<ApiKeyRow, 'key_hash'>[] {
  const db = getRawDb();
  return db
    .prepare(
      `SELECT id, user_id, key_prefix, label, developer_id, created_at, revoked_at
       FROM api_keys WHERE user_id = ? ORDER BY created_at DESC`,
    )
    .all(userId) as Omit<ApiKeyRow, 'key_hash'>[];
}

export function revokeApiKey(id: string): boolean {
  const db = getRawDb();
  const result = db
    .prepare("UPDATE api_keys SET revoked_at = datetime('now') WHERE id = ? AND revoked_at IS NULL")
    .run(id);
  return result.changes > 0;
}

export function revokeApiKeyForUser(id: string, userId: string): boolean {
  const db = getRawDb();
  const result = db
    .prepare("UPDATE api_keys SET revoked_at = datetime('now') WHERE id = ? AND user_id = ? AND revoked_at IS NULL")
    .run(id, userId);
  return result.changes > 0;
}

export function updateUserRole(id: string, role: string): UserRow | null {
  const db = getRawDb();
  db.prepare("UPDATE users SET role = ?, updated_at = datetime('now') WHERE id = ?").run(role, id);
  return findUserById(id);
}

export function updateUserDisplayName(id: string, displayName: string): UserRow | null {
  const db = getRawDb();
  db.prepare("UPDATE users SET display_name = ?, updated_at = datetime('now') WHERE id = ?").run(displayName, id);
  return findUserById(id);
}

export function listApiKeysForUserWithLastUsed(userId: string): (Omit<ApiKeyRow, 'key_hash'> & { last_used_at?: string | null })[] {
  const db = getRawDb();
  // Try to select last_used_at if it exists, fall back gracefully
  try {
    return db
      .prepare(
        `SELECT id, user_id, key_prefix, label, developer_id, created_at, revoked_at, last_used_at
         FROM api_keys WHERE user_id = ? ORDER BY created_at DESC`,
      )
      .all(userId) as (Omit<ApiKeyRow, 'key_hash'> & { last_used_at?: string | null })[];
  } catch {
    // Column doesn't exist — fall back to without last_used_at
    return db
      .prepare(
        `SELECT id, user_id, key_prefix, label, developer_id, created_at, revoked_at
         FROM api_keys WHERE user_id = ? ORDER BY created_at DESC`,
      )
      .all(userId) as (Omit<ApiKeyRow, 'key_hash'> & { last_used_at?: string | null })[];
  }
}

export function updateApiKeyLastUsed(keyHash: string): void {
  const db = getRawDb();
  db.prepare("UPDATE api_keys SET last_used_at = datetime('now') WHERE key_hash = ?").run(keyHash);
}

export function truncateUsageEntries(): number {
  const db = getRawDb();
  const result = db.prepare('DELETE FROM usage_entries').run();
  return result.changes;
}

export function deleteUsageEntriesForDeveloper(developerId: string): number {
  const db = getRawDb();
  const result = db.prepare('DELETE FROM usage_entries WHERE developer_id = ?').run(developerId);
  return result.changes;
}

export function deleteUsageEntriesForApiKey(apiKeyId: string): number {
  const db = getRawDb();
  const result = db.prepare('DELETE FROM usage_entries WHERE api_key_id = ?').run(apiKeyId);
  return result.changes;
}

export interface MachineUsageStat {
  apiKeyId: string;
  label: string;
  totalTokens: number;
  costUsd: number;
  entryCount: number;
  lastSeen: string | null;
  createdAt: string;
  revokedAt: string | null;
}

export function getMachineStatsForDeveloper(developerId: string): MachineUsageStat[] {
  const db = getRawDb();
  return db.prepare(`
    SELECT
      k.id          AS apiKeyId,
      k.label       AS label,
      k.created_at  AS createdAt,
      k.revoked_at  AS revokedAt,
      COALESCE(SUM(e.input_tokens + e.output_tokens + e.cache_creation_tokens + e.cache_read_tokens), 0) AS totalTokens,
      COALESCE(SUM(e.cost_usd), 0)   AS costUsd,
      COALESCE(COUNT(e.id), 0)       AS entryCount,
      MAX(e.timestamp)               AS lastSeen
    FROM api_keys k
    LEFT JOIN usage_entries e ON e.api_key_id = k.id
    WHERE k.developer_id = ? AND k.revoked_at IS NULL
    GROUP BY k.id
    ORDER BY k.created_at DESC
  `).all(developerId) as MachineUsageStat[];
}
