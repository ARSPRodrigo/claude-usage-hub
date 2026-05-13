import { randomUUID } from 'node:crypto';
import type {
  Organization,
  Workspace,
  OrgMembership,
  WorkspaceMembership,
} from '@claude-usage-hub/shared';
import { getRawDb } from './connection.js';

// ---------------------------------------------------------------------------
// Organizations
// ---------------------------------------------------------------------------

export function listOrganizations(): Organization[] {
  const raw = getRawDb();
  const rows = raw
    .prepare(`SELECT id, name, slug, created_at FROM organizations ORDER BY name`)
    .all() as Array<{ id: string; name: string; slug: string; created_at: string }>;
  return rows.map((r) => ({ id: r.id, name: r.name, slug: r.slug, createdAt: r.created_at }));
}

export function findOrganizationById(id: string): Organization | null {
  const raw = getRawDb();
  const row = raw
    .prepare(`SELECT id, name, slug, created_at FROM organizations WHERE id = ?`)
    .get(id) as { id: string; name: string; slug: string; created_at: string } | undefined;
  if (!row) return null;
  return { id: row.id, name: row.name, slug: row.slug, createdAt: row.created_at };
}

// ---------------------------------------------------------------------------
// Workspaces
// ---------------------------------------------------------------------------

export function listWorkspaces(orgId?: string): Workspace[] {
  const raw = getRawDb();
  const sql = orgId
    ? `SELECT id, org_id, name, slug, created_at FROM workspaces WHERE org_id = ? ORDER BY name`
    : `SELECT id, org_id, name, slug, created_at FROM workspaces ORDER BY name`;
  const rows = (orgId
    ? raw.prepare(sql).all(orgId)
    : raw.prepare(sql).all()) as Array<{ id: string; org_id: string; name: string; slug: string; created_at: string }>;
  return rows.map((r) => ({
    id: r.id, orgId: r.org_id, name: r.name, slug: r.slug, createdAt: r.created_at,
  }));
}

export function findWorkspaceById(id: string): Workspace | null {
  const raw = getRawDb();
  const row = raw
    .prepare(`SELECT id, org_id, name, slug, created_at FROM workspaces WHERE id = ?`)
    .get(id) as { id: string; org_id: string; name: string; slug: string; created_at: string } | undefined;
  if (!row) return null;
  return { id: row.id, orgId: row.org_id, name: row.name, slug: row.slug, createdAt: row.created_at };
}

// ---------------------------------------------------------------------------
// Active memberships
// ---------------------------------------------------------------------------

/** Return the user's currently-active org membership, or null if none. */
export function getActiveOrgMembership(userId: string): OrgMembership | null {
  const raw = getRawDb();
  const row = raw.prepare(`
    SELECT id, user_id, org_id, valid_from, valid_to, created_at
    FROM org_memberships
    WHERE user_id = ? AND valid_to IS NULL
    ORDER BY valid_from DESC
    LIMIT 1
  `).get(userId) as
    | { id: string; user_id: string; org_id: string; valid_from: string; valid_to: string | null; created_at: string }
    | undefined;
  if (!row) return null;
  return {
    id: row.id, userId: row.user_id, orgId: row.org_id,
    validFrom: row.valid_from, validTo: row.valid_to, createdAt: row.created_at,
  };
}

export function getActiveWorkspaceMembership(userId: string): WorkspaceMembership | null {
  const raw = getRawDb();
  const row = raw.prepare(`
    SELECT id, user_id, workspace_id, valid_from, valid_to, created_at
    FROM workspace_memberships
    WHERE user_id = ? AND valid_to IS NULL
    ORDER BY valid_from DESC
    LIMIT 1
  `).get(userId) as
    | { id: string; user_id: string; workspace_id: string; valid_from: string; valid_to: string | null; created_at: string }
    | undefined;
  if (!row) return null;
  return {
    id: row.id, userId: row.user_id, workspaceId: row.workspace_id,
    validFrom: row.valid_from, validTo: row.valid_to, createdAt: row.created_at,
  };
}

/** Open new memberships for a user. Closes any existing active membership first. */
export function assignUserToWorkspace(
  userId: string,
  orgId: string,
  workspaceId: string,
  now: string = new Date().toISOString(),
): void {
  const raw = getRawDb();
  raw.transaction(() => {
    raw.prepare(`UPDATE org_memberships SET valid_to = ? WHERE user_id = ? AND valid_to IS NULL`).run(now, userId);
    raw.prepare(`UPDATE workspace_memberships SET valid_to = ? WHERE user_id = ? AND valid_to IS NULL`).run(now, userId);
    raw.prepare(`
      INSERT INTO org_memberships (id, user_id, org_id, valid_from) VALUES (?, ?, ?, ?)
    `).run(randomUUID(), userId, orgId, now);
    raw.prepare(`
      INSERT INTO workspace_memberships (id, user_id, workspace_id, valid_from) VALUES (?, ?, ?, ?)
    `).run(randomUUID(), userId, workspaceId, now);
  })();
}

// ---------------------------------------------------------------------------
// Ownership
// ---------------------------------------------------------------------------

export function listOwnedOrgIds(userId: string): string[] {
  const raw = getRawDb();
  const rows = raw.prepare(`SELECT org_id FROM org_owners WHERE user_id = ?`).all(userId) as Array<{ org_id: string }>;
  return rows.map((r) => r.org_id);
}

export function listOwnedWorkspaceIds(userId: string): string[] {
  const raw = getRawDb();
  const rows = raw.prepare(`SELECT workspace_id FROM workspace_owners WHERE user_id = ?`).all(userId) as Array<{ workspace_id: string }>;
  return rows.map((r) => r.workspace_id);
}

// ---------------------------------------------------------------------------
// Domain auto-assign (read-only in Phase 1; used by sign-in path later)
// ---------------------------------------------------------------------------

export interface DomainRule {
  id: string;
  emailDomain: string;
  orgId: string;
  workspaceId: string;
}

export function findDomainRuleForEmail(email: string): DomainRule | null {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return null;
  const raw = getRawDb();
  const row = raw.prepare(`
    SELECT id, email_domain, org_id, workspace_id FROM domain_rules WHERE email_domain = ?
  `).get(domain) as { id: string; email_domain: string; org_id: string; workspace_id: string } | undefined;
  if (!row) return null;
  return { id: row.id, emailDomain: row.email_domain, orgId: row.org_id, workspaceId: row.workspace_id };
}
