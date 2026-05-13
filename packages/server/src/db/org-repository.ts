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

// ---------------------------------------------------------------------------
// CRUD: organizations
// ---------------------------------------------------------------------------

/** Slugify "ACME Engineering" → "acme-engineering". */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'org';
}

function uniqueOrgSlug(base: string): string {
  const raw = getRawDb();
  let slug = base;
  let n = 1;
  while (raw.prepare(`SELECT 1 FROM organizations WHERE slug = ?`).get(slug)) {
    n += 1;
    slug = `${base}-${n}`;
  }
  return slug;
}

export function createOrganization(args: { id: string; name: string }): Organization {
  const raw = getRawDb();
  const slug = uniqueOrgSlug(slugify(args.name));
  raw.prepare(`INSERT INTO organizations (id, name, slug) VALUES (?, ?, ?)`).run(args.id, args.name, slug);
  return { id: args.id, name: args.name, slug, createdAt: new Date().toISOString() };
}

export function updateOrganization(id: string, patch: { name?: string }): Organization | null {
  const raw = getRawDb();
  if (patch.name !== undefined) {
    raw.prepare(`UPDATE organizations SET name = ? WHERE id = ?`).run(patch.name, id);
  }
  return findOrganizationById(id);
}

/**
 * Delete an org. Refuses if there are active members, pending invitations,
 * or any usage_entries stamped with this org. Workspaces inside the org
 * are deleted first (also empty).
 */
export function deleteOrganization(id: string): { ok: boolean; reason?: string } {
  const raw = getRawDb();
  const activeMembers = raw.prepare(
    `SELECT COUNT(*) as c FROM org_memberships WHERE org_id = ? AND valid_to IS NULL`,
  ).get(id) as { c: number };
  if (activeMembers.c > 0) {
    return { ok: false, reason: `Org has ${activeMembers.c} active member(s). Move them out first.` };
  }
  const pendingInvites = raw.prepare(
    `SELECT COUNT(*) as c FROM invitations
     WHERE org_id = ? AND accepted_at IS NULL AND expires_at >= datetime('now')`,
  ).get(id) as { c: number };
  if (pendingInvites.c > 0) {
    return { ok: false, reason: `Org has ${pendingInvites.c} pending invitation(s). Revoke them first.` };
  }
  const entries = raw.prepare(`SELECT COUNT(*) as c FROM usage_entries WHERE organization_id = ?`).get(id) as { c: number };
  if (entries.c > 0) {
    return { ok: false, reason: `Org has ${entries.c} historical usage entries. Cannot be deleted to preserve audit trail.` };
  }

  raw.transaction(() => {
    raw.prepare(`DELETE FROM workspace_owners WHERE workspace_id IN (SELECT id FROM workspaces WHERE org_id = ?)`).run(id);
    raw.prepare(`DELETE FROM workspace_memberships WHERE workspace_id IN (SELECT id FROM workspaces WHERE org_id = ?)`).run(id);
    raw.prepare(`DELETE FROM workspaces WHERE org_id = ?`).run(id);
    raw.prepare(`DELETE FROM domain_rules WHERE org_id = ?`).run(id);
    raw.prepare(`DELETE FROM org_owners WHERE org_id = ?`).run(id);
    raw.prepare(`DELETE FROM org_memberships WHERE org_id = ?`).run(id);
    raw.prepare(`DELETE FROM organizations WHERE id = ?`).run(id);
  })();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// CRUD: workspaces
// ---------------------------------------------------------------------------

function uniqueWorkspaceSlug(orgId: string, base: string): string {
  const raw = getRawDb();
  let slug = base;
  let n = 1;
  while (raw.prepare(`SELECT 1 FROM workspaces WHERE org_id = ? AND slug = ?`).get(orgId, slug)) {
    n += 1;
    slug = `${base}-${n}`;
  }
  return slug;
}

export function createWorkspace(args: { id: string; orgId: string; name: string }): Workspace {
  const raw = getRawDb();
  const slug = uniqueWorkspaceSlug(args.orgId, slugify(args.name));
  raw.prepare(`INSERT INTO workspaces (id, org_id, name, slug) VALUES (?, ?, ?, ?)`).run(
    args.id, args.orgId, args.name, slug,
  );
  return { id: args.id, orgId: args.orgId, name: args.name, slug, createdAt: new Date().toISOString() };
}

export function updateWorkspace(id: string, patch: { name?: string }): Workspace | null {
  const raw = getRawDb();
  if (patch.name !== undefined) {
    raw.prepare(`UPDATE workspaces SET name = ? WHERE id = ?`).run(patch.name, id);
  }
  return findWorkspaceById(id);
}

export function deleteWorkspace(id: string): { ok: boolean; reason?: string } {
  const raw = getRawDb();
  const activeMembers = raw.prepare(
    `SELECT COUNT(*) as c FROM workspace_memberships WHERE workspace_id = ? AND valid_to IS NULL`,
  ).get(id) as { c: number };
  if (activeMembers.c > 0) {
    return { ok: false, reason: `Workspace has ${activeMembers.c} active member(s). Move them out first.` };
  }
  const pendingInvites = raw.prepare(
    `SELECT COUNT(*) as c FROM invitations
     WHERE workspace_id = ? AND accepted_at IS NULL AND expires_at >= datetime('now')`,
  ).get(id) as { c: number };
  if (pendingInvites.c > 0) {
    return { ok: false, reason: `Workspace has ${pendingInvites.c} pending invitation(s). Revoke them first.` };
  }
  const entries = raw.prepare(`SELECT COUNT(*) as c FROM usage_entries WHERE workspace_id = ?`).get(id) as { c: number };
  if (entries.c > 0) {
    return { ok: false, reason: `Workspace has ${entries.c} historical usage entries. Cannot be deleted to preserve audit trail.` };
  }

  raw.transaction(() => {
    raw.prepare(`DELETE FROM workspace_owners WHERE workspace_id = ?`).run(id);
    raw.prepare(`DELETE FROM workspace_memberships WHERE workspace_id = ?`).run(id);
    raw.prepare(`DELETE FROM domain_rules WHERE workspace_id = ?`).run(id);
    raw.prepare(`DELETE FROM workspaces WHERE id = ?`).run(id);
  })();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export interface RoleAuditEntry {
  id: string;
  actorId: string;
  targetId: string;
  action: string;
  scopeId: string | null;
  scopeType: 'org' | 'workspace' | null;
  timestamp: string;
}

export function writeAudit(args: {
  id: string;
  actorId: string;
  targetId: string;
  action: string;
  scopeId?: string | null;
  scopeType?: 'org' | 'workspace' | null;
}): void {
  const raw = getRawDb();
  raw.prepare(`
    INSERT INTO role_audit (id, actor_id, target_id, action, scope_id, scope_type)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(args.id, args.actorId, args.targetId, args.action, args.scopeId ?? null, args.scopeType ?? null);
}

export function listRoleAudit(limit: number = 100): RoleAuditEntry[] {
  const raw = getRawDb();
  const rows = raw.prepare(`
    SELECT id, actor_id, target_id, action, scope_id, scope_type, timestamp
    FROM role_audit ORDER BY timestamp DESC LIMIT ?
  `).all(limit) as Array<{
    id: string; actor_id: string; target_id: string; action: string;
    scope_id: string | null; scope_type: string | null; timestamp: string;
  }>;
  return rows.map((r) => ({
    id: r.id, actorId: r.actor_id, targetId: r.target_id, action: r.action,
    scopeId: r.scope_id, scopeType: (r.scope_type as 'org' | 'workspace' | null) ?? null,
    timestamp: r.timestamp,
  }));
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
