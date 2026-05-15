import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createDb, closeDb, getRawDb } from '../db/connection.js';
import { runMigrations } from '../db/migrate.js';
import { createApp } from '../app.js';
import { setJwtSecret, signJwt } from '../middleware/auth.js';
import { hashPassword } from '../services/auth-utils.js';
import { createUser } from '../db/auth-repository.js';
import {
  createOrganization,
  createWorkspace,
  addOrgOwner,
  addWorkspaceOwner,
  listOwnedOrgIds,
  listOwnedWorkspaceIds,
  removeOrgOwner,
  assignUserToWorkspace,
  getActiveOrgMembership,
  getActiveWorkspaceMembership,
  createDomainRule,
} from '../db/org-repository.js';
import type { UserRole } from '@claude-usage-hub/shared';

const JWT_SECRET = 'test-secret-for-orgs-tests';

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function tokenFor(args: { id: string; email: string; role: UserRole; developerId: string }) {
  return signJwt(args);
}

/** Create a fresh user with the given role and active org/workspace membership. */
function makeUser(args: {
  email: string;
  role: UserRole;
  developerId?: string;
  orgId?: string;
  workspaceId?: string;
}): string {
  const id = randomUUID();
  createUser({
    id,
    email: args.email,
    displayName: args.email.split('@')[0],
    role: args.role,
    developerId: args.developerId ?? `dev-${id.slice(0, 8)}`,
    passwordHash: hashPassword('password1234'),
  });
  if (args.orgId && args.workspaceId) {
    assignUserToWorkspace(id, args.orgId, args.workspaceId);
  }
  return id;
}

describe('orgs / grants / scope integration', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    const { raw } = createDb(':memory:');
    runMigrations(raw);
    setJwtSecret(JWT_SECRET);
    app = createApp('team');
  });

  afterEach(() => closeDb());

  // ── Ownership grants + scope ───────────────────────────────────────────

  describe('ownership grants', () => {
    it('platform admin can grant org ownership and revoke it', async () => {
      const ownerId = makeUser({ email: 'po@x.com', role: 'platform_owner' });
      const targetId = makeUser({ email: 't@x.com', role: 'developer' });
      const acmeId = randomUUID();
      createOrganization({ id: acmeId, name: 'Acme' });
      // Seed an existing owner so the revoke step doesn't trip the last-owner
      // guardrail (covered in its own test below).
      addOrgOwner(ownerId, acmeId);

      const token = await tokenFor({ id: ownerId, email: 'po@x.com', role: 'platform_owner', developerId: 'po' });

      const grant = await app.request('/api/v1/admin/org-owners', {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ userId: targetId, orgId: acmeId }),
      });
      expect(grant.status).toBe(200);
      expect(listOwnedOrgIds(targetId)).toContain(acmeId);

      const revoke = await app.request(`/api/v1/admin/org-owners/${targetId}/${acmeId}`, {
        method: 'DELETE',
        headers: authHeaders(token),
      });
      expect(revoke.status).toBe(200);
      expect(listOwnedOrgIds(targetId)).not.toContain(acmeId);
    });

    it('refuses to remove the last org owner (last-owner guardrail)', async () => {
      const ownerId = makeUser({ email: 'po@x.com', role: 'platform_owner' });
      const lonelyOwner = makeUser({ email: 'lonely@x.com', role: 'developer' });
      const acmeId = randomUUID();
      createOrganization({ id: acmeId, name: 'Acme' });
      addOrgOwner(lonelyOwner, acmeId);

      const token = await tokenFor({ id: ownerId, email: 'po@x.com', role: 'platform_owner', developerId: 'po' });
      const res = await app.request(`/api/v1/admin/org-owners/${lonelyOwner}/${acmeId}`, {
        method: 'DELETE',
        headers: authHeaders(token),
      });
      expect(res.status).toBe(409);
      expect(listOwnedOrgIds(lonelyOwner)).toContain(acmeId);
    });

    it('org owner cannot grant ownership in an org they do not own', async () => {
      const acmeId = randomUUID();
      const initechId = randomUUID();
      createOrganization({ id: acmeId, name: 'Acme' });
      createOrganization({ id: initechId, name: 'Initech' });

      const acmeOwner = makeUser({ email: 'a@x.com', role: 'developer' });
      addOrgOwner(acmeOwner, acmeId);
      const someone = makeUser({ email: 's@x.com', role: 'developer' });

      const token = await tokenFor({ id: acmeOwner, email: 'a@x.com', role: 'developer', developerId: 'a' });

      // Granting in Acme: allowed (caller owns Acme)
      const allowed = await app.request('/api/v1/admin/org-owners', {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ userId: someone, orgId: acmeId }),
      });
      expect(allowed.status).toBe(200);

      // Granting in Initech: forbidden
      const forbidden = await app.request('/api/v1/admin/org-owners', {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ userId: someone, orgId: initechId }),
      });
      expect(forbidden.status).toBe(403);
    });
  });

  // ── Cascade on move ────────────────────────────────────────────────────

  describe('cascade on user move', () => {
    it('drops org and workspace ownership when user moves out of an org', () => {
      const acmeId = randomUUID();
      const acmeWs = randomUUID();
      const initechId = randomUUID();
      const initechWs = randomUUID();
      createOrganization({ id: acmeId, name: 'Acme' });
      createWorkspace({ id: acmeWs, orgId: acmeId, name: 'Acme WS' });
      createOrganization({ id: initechId, name: 'Initech' });
      createWorkspace({ id: initechWs, orgId: initechId, name: 'Initech WS' });

      const userId = makeUser({ email: 'u@x.com', role: 'developer', orgId: acmeId, workspaceId: acmeWs });
      // Grant ownership of both Acme + a workspace inside Acme.
      addOrgOwner(userId, acmeId);
      addWorkspaceOwner(userId, acmeWs);
      expect(listOwnedOrgIds(userId)).toContain(acmeId);
      expect(listOwnedWorkspaceIds(userId)).toContain(acmeWs);

      // Move out of Acme into Initech.
      const result = assignUserToWorkspace(userId, initechId, initechWs);
      expect(result.previousOrgId).toBe(acmeId);

      // Ownership in Acme should be gone.
      expect(listOwnedOrgIds(userId)).not.toContain(acmeId);
      expect(listOwnedWorkspaceIds(userId)).not.toContain(acmeWs);
      // Active membership now Initech.
      expect(getActiveOrgMembership(userId)?.orgId).toBe(initechId);
      expect(getActiveWorkspaceMembership(userId)?.workspaceId).toBe(initechWs);
    });

    it('preserves ownership of workspaces in other orgs when moving', () => {
      const acmeId = randomUUID();
      const acmeWs = randomUUID();
      const initechId = randomUUID();
      const initechWs = randomUUID();
      const initechWs2 = randomUUID();
      createOrganization({ id: acmeId, name: 'Acme' });
      createWorkspace({ id: acmeWs, orgId: acmeId, name: 'Acme WS' });
      createOrganization({ id: initechId, name: 'Initech' });
      createWorkspace({ id: initechWs, orgId: initechId, name: 'Initech WS' });
      createWorkspace({ id: initechWs2, orgId: initechId, name: 'Initech WS2' });

      const userId = makeUser({ email: 'u@x.com', role: 'developer', orgId: acmeId, workspaceId: acmeWs });
      // User happens to be a workspace owner of a workspace in another org.
      addWorkspaceOwner(userId, initechWs2);

      assignUserToWorkspace(userId, initechId, initechWs);
      // The Initech workspace ownership is in a different org from where they
      // came from (Acme), so it must be preserved.
      expect(listOwnedWorkspaceIds(userId)).toContain(initechWs2);
    });
  });

  // ── Platform Owner transfer ────────────────────────────────────────────

  describe('platform owner transfer', () => {
    it('transfers ownership, demotes the previous owner', async () => {
      const ownerId = makeUser({ email: 'po@x.com', role: 'platform_owner' });
      const successorId = makeUser({ email: 'next@x.com', role: 'developer' });

      const token = await tokenFor({ id: ownerId, email: 'po@x.com', role: 'platform_owner', developerId: 'po' });
      const res = await app.request('/api/v1/admin/transfer-platform-owner', {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ targetEmail: 'next@x.com', confirm: 'next@x.com' }),
      });
      expect(res.status).toBe(200);

      const raw = getRawDb();
      const succ = raw.prepare('SELECT role FROM users WHERE id = ?').get(successorId) as { role: string };
      const prev = raw.prepare('SELECT role FROM users WHERE id = ?').get(ownerId) as { role: string };
      expect(succ.role).toBe('platform_owner');
      expect(prev.role).toBe('platform_admin');
    });

    it('refuses when confirm does not match targetEmail', async () => {
      const ownerId = makeUser({ email: 'po@x.com', role: 'platform_owner' });
      makeUser({ email: 'next@x.com', role: 'developer' });
      const token = await tokenFor({ id: ownerId, email: 'po@x.com', role: 'platform_owner', developerId: 'po' });

      const res = await app.request('/api/v1/admin/transfer-platform-owner', {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ targetEmail: 'next@x.com', confirm: 'typo@x.com' }),
      });
      expect(res.status).toBe(400);
    });

    it('non-platform-owner cannot transfer', async () => {
      const adminId = makeUser({ email: 'admin@x.com', role: 'platform_admin' });
      makeUser({ email: 'next@x.com', role: 'developer' });
      const token = await tokenFor({ id: adminId, email: 'admin@x.com', role: 'platform_admin', developerId: 'admin' });
      const res = await app.request('/api/v1/admin/transfer-platform-owner', {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ targetEmail: 'next@x.com', confirm: 'next@x.com' }),
      });
      expect(res.status).toBe(403);
    });
  });

  // ── Invitation scope checks ────────────────────────────────────────────

  describe('invitation scope', () => {
    it('org owner can invite into their own org but not someone else’s', async () => {
      const acmeId = randomUUID();
      const acmeWs = randomUUID();
      const initechId = randomUUID();
      const initechWs = randomUUID();
      createOrganization({ id: acmeId, name: 'Acme' });
      createWorkspace({ id: acmeWs, orgId: acmeId, name: 'Acme WS' });
      createOrganization({ id: initechId, name: 'Initech' });
      createWorkspace({ id: initechWs, orgId: initechId, name: 'Initech WS' });

      const acmeOwner = makeUser({ email: 'a@x.com', role: 'developer' });
      addOrgOwner(acmeOwner, acmeId);
      const token = await tokenFor({ id: acmeOwner, email: 'a@x.com', role: 'developer', developerId: 'a' });

      const ok = await app.request('/api/v1/admin/invitations', {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ email: 'newie@x.com', orgId: acmeId, workspaceId: acmeWs }),
      });
      expect(ok.status).toBe(201);

      const bad = await app.request('/api/v1/admin/invitations', {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ email: 'newie2@x.com', orgId: initechId, workspaceId: initechWs }),
      });
      expect(bad.status).toBe(403);
    });

    it('bulk invite returns per-row scope errors without aborting batch', async () => {
      const acmeId = randomUUID();
      const acmeWs = randomUUID();
      const initechId = randomUUID();
      const initechWs = randomUUID();
      createOrganization({ id: acmeId, name: 'Acme' });
      createWorkspace({ id: acmeWs, orgId: acmeId, name: 'Acme WS' });
      createOrganization({ id: initechId, name: 'Initech' });
      createWorkspace({ id: initechWs, orgId: initechId, name: 'Initech WS' });

      const acmeOwner = makeUser({ email: 'a@x.com', role: 'developer' });
      addOrgOwner(acmeOwner, acmeId);
      const token = await tokenFor({ id: acmeOwner, email: 'a@x.com', role: 'developer', developerId: 'a' });

      const res = await app.request('/api/v1/admin/invitations/bulk', {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({
          invites: [
            { email: 'ok@x.com', orgId: acmeId, workspaceId: acmeWs },
            { email: 'forbidden@x.com', orgId: initechId, workspaceId: initechWs },
          ],
        }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as { results: Array<{ email: string; inviteUrl?: string; error?: string }> };
      expect(body.results[0]?.inviteUrl).toBeTruthy();
      expect(body.results[1]?.error).toMatch(/Forbidden/);
    });

    it('platform admin can list all invitations; org owner only sees their org’s', async () => {
      const acmeId = randomUUID();
      const acmeWs = randomUUID();
      const initechId = randomUUID();
      const initechWs = randomUUID();
      createOrganization({ id: acmeId, name: 'Acme' });
      createWorkspace({ id: acmeWs, orgId: acmeId, name: 'Acme WS' });
      createOrganization({ id: initechId, name: 'Initech' });
      createWorkspace({ id: initechWs, orgId: initechId, name: 'Initech WS' });

      const po = makeUser({ email: 'po@x.com', role: 'platform_owner' });
      const acmeOwner = makeUser({ email: 'a@x.com', role: 'developer' });
      addOrgOwner(acmeOwner, acmeId);
      const poToken = await tokenFor({ id: po, email: 'po@x.com', role: 'platform_owner', developerId: 'po' });
      const aoToken = await tokenFor({ id: acmeOwner, email: 'a@x.com', role: 'developer', developerId: 'a' });

      // Create one invite into each org via the platform owner so we have data.
      await app.request('/api/v1/admin/invitations', {
        method: 'POST',
        headers: authHeaders(poToken),
        body: JSON.stringify({ email: 'one@x.com', orgId: acmeId, workspaceId: acmeWs }),
      });
      await app.request('/api/v1/admin/invitations', {
        method: 'POST',
        headers: authHeaders(poToken),
        body: JSON.stringify({ email: 'two@x.com', orgId: initechId, workspaceId: initechWs }),
      });

      const poList = await (await app.request('/api/v1/admin/invitations', { headers: authHeaders(poToken) })).json() as Array<{ email: string }>;
      expect(poList.length).toBe(2);

      const ownerList = await (await app.request('/api/v1/admin/invitations', { headers: authHeaders(aoToken) })).json() as Array<{ email: string }>;
      expect(ownerList.length).toBe(1);
      expect(ownerList[0]?.email).toBe('one@x.com');
    });
  });

  // ── Domain auto-assign ─────────────────────────────────────────────────

  describe('domain rules', () => {
    it('createDomainRule and findDomainRuleForEmail round-trip', async () => {
      const acmeId = randomUUID();
      const acmeWs = randomUUID();
      createOrganization({ id: acmeId, name: 'Acme' });
      createWorkspace({ id: acmeWs, orgId: acmeId, name: 'Acme WS' });
      createDomainRule({ id: randomUUID(), emailDomain: 'acme.com', orgId: acmeId, workspaceId: acmeWs });

      // We can't easily exercise /auth/google/verify without mocking Google,
      // so verify the rule applies via the repository helper used by sign-in.
      const { findDomainRuleForEmail } = await import('../db/org-repository.js');
      const rule = findDomainRuleForEmail('user@acme.com');
      expect(rule?.orgId).toBe(acmeId);
      expect(rule?.workspaceId).toBe(acmeWs);
    });
  });

  // ── Scope helpers used by /admin/* filters ─────────────────────────────

  describe('GET /admin/organizations filtering', () => {
    it('org owner only sees orgs they own', async () => {
      const acmeId = randomUUID();
      const initechId = randomUUID();
      createOrganization({ id: acmeId, name: 'Acme' });
      createOrganization({ id: initechId, name: 'Initech' });

      const acmeOwner = makeUser({ email: 'a@x.com', role: 'developer' });
      addOrgOwner(acmeOwner, acmeId);
      const token = await tokenFor({ id: acmeOwner, email: 'a@x.com', role: 'developer', developerId: 'a' });

      const res = await app.request('/api/v1/admin/organizations', { headers: authHeaders(token) });
      expect(res.status).toBe(200);
      const orgs = await res.json() as Array<{ id: string }>;
      expect(orgs.map((o) => o.id)).toContain(acmeId);
      expect(orgs.map((o) => o.id)).not.toContain(initechId);
    });
  });
});
