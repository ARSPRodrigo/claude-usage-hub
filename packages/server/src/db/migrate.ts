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

  // Phase 1 (orgs foundation): multi-org / workspace / role tables
  raw.exec(`
    CREATE TABLE IF NOT EXISTS organizations (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      slug        TEXT NOT NULL UNIQUE,
      created_at  TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS workspaces (
      id          TEXT PRIMARY KEY,
      org_id      TEXT NOT NULL REFERENCES organizations(id),
      name        TEXT NOT NULL,
      slug        TEXT NOT NULL,
      created_at  TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (org_id, slug)
    );
    CREATE INDEX IF NOT EXISTS idx_workspaces_org ON workspaces(org_id);

    -- Time-bounded org membership. valid_to IS NULL means active.
    CREATE TABLE IF NOT EXISTS org_memberships (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id),
      org_id      TEXT NOT NULL REFERENCES organizations(id),
      valid_from  TEXT NOT NULL,
      valid_to    TEXT,
      created_at  TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_org_mem_user_active
      ON org_memberships(user_id) WHERE valid_to IS NULL;
    CREATE INDEX IF NOT EXISTS idx_org_mem_org_active
      ON org_memberships(org_id) WHERE valid_to IS NULL;

    CREATE TABLE IF NOT EXISTS workspace_memberships (
      id            TEXT PRIMARY KEY,
      user_id       TEXT NOT NULL REFERENCES users(id),
      workspace_id  TEXT NOT NULL REFERENCES workspaces(id),
      valid_from    TEXT NOT NULL,
      valid_to      TEXT,
      created_at    TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_ws_mem_user_active
      ON workspace_memberships(user_id) WHERE valid_to IS NULL;
    CREATE INDEX IF NOT EXISTS idx_ws_mem_ws_active
      ON workspace_memberships(workspace_id) WHERE valid_to IS NULL;

    -- Ownership: many-to-many. A user can own multiple orgs / workspaces.
    CREATE TABLE IF NOT EXISTS org_owners (
      user_id     TEXT NOT NULL REFERENCES users(id),
      org_id      TEXT NOT NULL REFERENCES organizations(id),
      created_at  TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, org_id)
    );
    CREATE INDEX IF NOT EXISTS idx_org_owners_org ON org_owners(org_id);

    CREATE TABLE IF NOT EXISTS workspace_owners (
      user_id       TEXT NOT NULL REFERENCES users(id),
      workspace_id  TEXT NOT NULL REFERENCES workspaces(id),
      created_at    TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, workspace_id)
    );
    CREATE INDEX IF NOT EXISTS idx_ws_owners_ws ON workspace_owners(workspace_id);

    -- Domain auto-assign: emails matching email_domain are placed in this org/ws on first sign-in.
    CREATE TABLE IF NOT EXISTS domain_rules (
      id            TEXT PRIMARY KEY,
      email_domain  TEXT NOT NULL UNIQUE,
      org_id        TEXT NOT NULL REFERENCES organizations(id),
      workspace_id  TEXT NOT NULL REFERENCES workspaces(id),
      created_at    TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Audit log for role / membership changes.
    CREATE TABLE IF NOT EXISTS role_audit (
      id          TEXT PRIMARY KEY,
      actor_id    TEXT NOT NULL REFERENCES users(id),
      target_id   TEXT NOT NULL REFERENCES users(id),
      action      TEXT NOT NULL,
      scope_id    TEXT,
      scope_type  TEXT,
      timestamp   TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_role_audit_timestamp ON role_audit(timestamp);
  `);

  // Denormalised org/workspace columns on usage_entries — stamped at ingest.
  try {
    raw.exec(`ALTER TABLE usage_entries ADD COLUMN organization_id TEXT`);
    raw.exec(`CREATE INDEX IF NOT EXISTS idx_entries_org ON usage_entries(organization_id)`);
  } catch {
    // Column already exists — safe to ignore
  }
  try {
    raw.exec(`ALTER TABLE usage_entries ADD COLUMN workspace_id TEXT`);
    raw.exec(`CREATE INDEX IF NOT EXISTS idx_entries_ws ON usage_entries(workspace_id)`);
  } catch {
    // Column already exists — safe to ignore
  }

  // Org / workspace scope on invitations.
  try {
    raw.exec(`ALTER TABLE invitations ADD COLUMN org_id TEXT REFERENCES organizations(id)`);
  } catch { /* exists */ }
  try {
    raw.exec(`ALTER TABLE invitations ADD COLUMN workspace_id TEXT REFERENCES workspaces(id)`);
  } catch { /* exists */ }

  if (mode === 'team') {
    bootstrapAdmin(raw);
    backfillDefaultOrg(raw);
  }
}

/**
 * Phase 1 one-shot migration: ensures every existing user/entry is attached
 * to a "Default Organization" / "Default Workspace". Idempotent.
 *
 *  - Creates the default org + workspace if missing.
 *  - Opens an active org_memberships + workspace_memberships row for every user
 *    that doesn't already have one.
 *  - Stamps organization_id / workspace_id on every usage_entries row that
 *    doesn't have one yet.
 *  - Migrates legacy roles:
 *      primary_owner → platform_owner (singular)
 *      owner         → platform_admin (preserves their reach)
 *      developer     → unchanged
 *  - Promotes existing primary_owner to be an org_owner of Default Org so they
 *    keep org-level reach after Phase 2/3 ship.
 */
function backfillDefaultOrg(raw: Database.Database): void {
  const DEFAULT_ORG_ID = 'default';
  const DEFAULT_WS_ID = 'default-ws';

  // 1) Ensure default org + workspace exist.
  raw.prepare(`
    INSERT OR IGNORE INTO organizations (id, name, slug)
    VALUES (?, 'Default Organization', 'default')
  `).run(DEFAULT_ORG_ID);

  raw.prepare(`
    INSERT OR IGNORE INTO workspaces (id, org_id, name, slug)
    VALUES (?, ?, 'Default Workspace', 'default')
  `).run(DEFAULT_WS_ID, DEFAULT_ORG_ID);

  // 2) Open membership rows for every user without an active org/workspace membership.
  const users = raw.prepare(`SELECT id, created_at, role FROM users`).all() as Array<{ id: string; created_at: string; role: string }>;

  const insertOrgMem = raw.prepare(`
    INSERT INTO org_memberships (id, user_id, org_id, valid_from)
    SELECT ?, ?, ?, ?
    WHERE NOT EXISTS (
      SELECT 1 FROM org_memberships WHERE user_id = ? AND valid_to IS NULL
    )
  `);
  const insertWsMem = raw.prepare(`
    INSERT INTO workspace_memberships (id, user_id, workspace_id, valid_from)
    SELECT ?, ?, ?, ?
    WHERE NOT EXISTS (
      SELECT 1 FROM workspace_memberships WHERE user_id = ? AND valid_to IS NULL
    )
  `);
  const insertOrgOwner = raw.prepare(`
    INSERT OR IGNORE INTO org_owners (user_id, org_id) VALUES (?, ?)
  `);
  const updateRole = raw.prepare(`UPDATE users SET role = ? WHERE id = ?`);

  raw.transaction(() => {
    for (const u of users) {
      insertOrgMem.run(randomUUID(), u.id, DEFAULT_ORG_ID, u.created_at, u.id);
      insertWsMem.run(randomUUID(), u.id, DEFAULT_WS_ID, u.created_at, u.id);

      // Role migration
      if (u.role === 'primary_owner') {
        updateRole.run('platform_owner', u.id);
        insertOrgOwner.run(u.id, DEFAULT_ORG_ID);
      } else if (u.role === 'owner') {
        updateRole.run('platform_admin', u.id);
        insertOrgOwner.run(u.id, DEFAULT_ORG_ID);
      }
      // 'developer' unchanged
    }
  })();

  // 3) Stamp organization_id / workspace_id on entries that are missing them.
  raw.prepare(`
    UPDATE usage_entries SET organization_id = ? WHERE organization_id IS NULL
  `).run(DEFAULT_ORG_ID);
  raw.prepare(`
    UPDATE usage_entries SET workspace_id = ? WHERE workspace_id IS NULL
  `).run(DEFAULT_WS_ID);
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
     VALUES (?, ?, ?, 'platform_owner', ?, ?)`,
  ).run(id, email, 'Platform Owner', developerId, passwordHash);

  console.log(`Platform owner created: ${email}`);
}
