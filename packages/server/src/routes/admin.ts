import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { createApiKeySchema, createDeveloperSchema, computeComparisonCosts } from '@claude-usage-hub/shared';
import type { AppEnv } from '../env.js';
import type { AuthContext, TimeRange } from '@claude-usage-hub/shared';
import {
  createUser,
  listUsers,
  findUserByEmail,
  findUserById,
  createApiKey,
  listApiKeys,
  revokeApiKey,
  updateUserRole,
  truncateUsageEntries,
  deleteUsageEntriesForDeveloper,
  deleteUsageEntriesForApiKey,
  getMachineStatsForDeveloper,
} from '../db/auth-repository.js';
import { hashPassword, generateApiKey } from '../services/auth-utils.js';
import { invitationRoutes } from './invitations.js';
import { getDeveloperStats, getDashboardStats, getTokenTimeseries, getAggregateTokensByTier } from '../db/repository.js';
import {
  listOrganizations,
  listWorkspaces,
  findOrganizationById,
  findWorkspaceById,
  createOrganization,
  updateOrganization,
  deleteOrganization,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  writeAudit,
  listRoleAudit,
  assignUserToWorkspace,
  getActiveOrgMembership,
  getActiveWorkspaceMembership,
} from '../db/org-repository.js';
import { requireAdmin, requirePrimaryOwner } from '../middleware/auth.js';

const VALID_RANGES = new Set(['5h', '24h', '7d', '30d', 'all']);
const admin = new Hono<AppEnv>();

/**
 * Parse optional ?orgId=&workspaceId= query params, validating membership.
 * Returns the scope filter to pass to repository queries.
 *
 * Platform admin: any org/workspace allowed.
 * Org owner: only their owned orgs allowed; others stripped to undefined.
 * Anyone else: stripped (admin routes are already JWT-protected, this is belt
 * and braces for the future when /admin is opened to org_owner role).
 */
function parseScope(c: { req: { query: (k: string) => string | undefined }; get: (k: 'auth') => unknown }):
  { organizationId?: string; workspaceId?: string } {
  const auth = c.get('auth') as AuthContext | undefined;
  const orgId = c.req.query('orgId');
  const wsId = c.req.query('workspaceId');
  if (!orgId && !wsId) return {};

  // Validate org/workspace exist.
  const validOrg = orgId ? !!findOrganizationById(orgId) : true;
  const validWs = wsId ? !!findWorkspaceById(wsId) : true;
  if (!validOrg || !validWs) return {};

  // Platform admin / owner: trust the request.
  // Compare as string to allow legacy role values during rollout.
  const role = String(auth?.role ?? '');
  const isPlatform =
    role === 'platform_owner' || role === 'platform_admin' || role === 'primary_owner' || role === 'owner';
  if (isPlatform) return { ...(orgId ? { organizationId: orgId } : {}), ...(wsId ? { workspaceId: wsId } : {}) };

  // Org owner: only allow scoping to orgs they own.
  const ownedOrgs = auth?.ownedOrgIds ?? [];
  if (orgId && !ownedOrgs.includes(orgId)) return {};
  return { ...(orgId ? { organizationId: orgId } : {}), ...(wsId ? { workspaceId: wsId } : {}) };
}

/** POST /api/v1/admin/developers — create a developer account. */
admin.post('/developers', async (c) => {
  const body = await c.req.json();
  const parsed = createDeveloperSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid request: ' + parsed.error.message }, 400);
  }

  const { email, password, displayName, developerId } = parsed.data;

  // Check for duplicate email
  if (findUserByEmail(email)) {
    return c.json({ error: 'Email already registered' }, 409);
  }

  const id = randomUUID();
  const passwordHash = hashPassword(password);

  createUser({ id, email, displayName, role: 'developer', developerId, passwordHash });

  return c.json(
    {
      id,
      email,
      displayName,
      role: 'developer',
      developerId,
    },
    201,
  );
});

/** GET /api/v1/admin/developers — list all users. */
admin.get('/developers', (c) => {
  const users = listUsers();
  return c.json(
    users.map((u) => ({
      id: u.id,
      email: u.email,
      displayName: u.display_name,
      role: u.role,
      developerId: u.developer_id,
      createdAt: u.created_at,
    })),
  );
});

/** PATCH /api/v1/admin/developers/:id/role — change a user's role */
admin.patch('/developers/:id/role', async (c) => {
  const auth = c.get('auth') as AuthContext | undefined;
  const targetId = c.req.param('id');
  const body = await c.req.json() as { role?: string };

  // Accept both new and legacy role names so the UI can keep using either during rollout.
  const validRoles = ['platform_admin', 'developer', 'owner'];
  if (!body.role || !validRoles.includes(body.role)) {
    return c.json({ error: 'Invalid role. Must be "platform_admin" or "developer".' }, 400);
  }
  // Normalise legacy "owner" → "platform_admin".
  const normalisedRole = body.role === 'owner' ? 'platform_admin' : body.role;

  const target = findUserById(targetId);
  if (!target) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Cannot change the platform owner's role (legacy primary_owner also blocked).
  if (target.role === 'platform_owner' || target.role === 'primary_owner') {
    return c.json({ error: 'Cannot change the role of the platform owner.' }, 403);
  }

  const updated = updateUserRole(targetId, normalisedRole);
  if (!updated) {
    return c.json({ error: 'Failed to update role' }, 500);
  }

  return c.json({
    id: updated.id,
    email: updated.email,
    displayName: updated.display_name,
    role: updated.role,
    developerId: updated.developer_id,
  });
});

/** POST /api/v1/admin/api-keys — generate an API key for a user. */
admin.post('/api-keys', async (c) => {
  const body = await c.req.json();
  const parsed = createApiKeySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid request: ' + parsed.error.message }, 400);
  }

  const { userId, label } = parsed.data;

  const user = findUserById(userId);
  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  const id = randomUUID();
  const { key, keyHash, keyPrefix } = generateApiKey();

  createApiKey({
    id,
    userId,
    keyPrefix,
    keyHash,
    label,
    developerId: user.developer_id,
  });

  // Return the raw key — shown this one time only
  return c.json(
    {
      id,
      key,
      keyPrefix,
      label,
      developerId: user.developer_id,
    },
    201,
  );
});

/** GET /api/v1/admin/api-keys — list all API keys (no hashes). */
admin.get('/api-keys', (c) => {
  const keys = listApiKeys();
  return c.json(
    keys.map((k) => ({
      id: k.id,
      userId: k.user_id,
      keyPrefix: k.key_prefix,
      label: k.label,
      developerId: k.developer_id,
      createdAt: k.created_at,
      revokedAt: k.revoked_at,
    })),
  );
});

/** DELETE /api/v1/admin/api-keys/:id — revoke an API key. */
admin.delete('/api-keys/:id', (c) => {
  const id = c.req.param('id');
  const revoked = revokeApiKey(id);
  if (!revoked) {
    return c.json({ error: 'API key not found or already revoked' }, 404);
  }
  return c.json({ ok: true });
});

// Mount invitation management under /invitations
admin.route('/invitations', invitationRoutes);

/** GET /api/v1/admin/stats/developers — per-member usage breakdown */
admin.get('/stats/developers', (c) => {
  const rangeParam = c.req.query('range') ?? 'all';
  const range: TimeRange = VALID_RANGES.has(rangeParam) ? (rangeParam as TimeRange) : 'all';
  return c.json(getDeveloperStats(range, parseScope(c)));
});

/** GET /api/v1/admin/stats/overview — org-wide totals */
admin.get('/stats/overview', (c) => {
  const range = (c.req.query('range') as 'all' | '7d' | '30d' | '24h' | '5h') ?? 'all';
  const validRanges = new Set(['5h', '24h', '7d', '30d', 'all']);
  const safeRange = validRanges.has(range) ? range : 'all';
  return c.json(getDashboardStats(safeRange as import('@claude-usage-hub/shared').TimeRange, parseScope(c)));
});

/** GET /api/v1/admin/developer-stats/:developerId — scoped stats for a developer */
admin.get('/developer-stats/:developerId', (c) => {
  const developerId = c.req.param('developerId');
  const range = c.req.query('range') ?? '7d';
  const validRanges = new Set(['5h', '24h', '7d', '30d', 'all']);
  const safeRange = (validRanges.has(range) ? range : '7d') as import('@claude-usage-hub/shared').TimeRange;
  return c.json(getDashboardStats(safeRange, developerId));
});

/** GET /api/v1/admin/developer-timeseries/:developerId — scoped timeseries */
admin.get('/developer-timeseries/:developerId', (c) => {
  const developerId = c.req.param('developerId');
  const range = c.req.query('range') ?? '7d';
  const validRanges = new Set(['5h', '24h', '7d', '30d', 'all']);
  const safeRange = (validRanges.has(range) ? range : '7d') as import('@claude-usage-hub/shared').TimeRange;
  return c.json(getTokenTimeseries(safeRange, developerId));
});

/** GET /api/v1/admin/settings — return org settings */
admin.get('/settings', (c) => {
  return c.json({
    retentionDays: parseInt(process.env['RETENTION_DAYS'] ?? '90', 10),
    allowedDomain: process.env['ALLOWED_DOMAIN'] ?? '',
    mode: process.env['MODE'] ?? 'local',
  });
});

/** PATCH /api/v1/admin/settings — update settings (retention period) */
admin.patch('/settings', async (c) => {
  const body = await c.req.json() as { retentionDays?: number };
  if (typeof body.retentionDays !== 'number' || body.retentionDays < 1) {
    return c.json({ error: 'retentionDays must be a positive number' }, 400);
  }
  // In-memory update only (actual enforcement is in data pipeline)
  process.env['RETENTION_DAYS'] = String(body.retentionDays);
  return c.json({ ok: true });
});

/** DELETE /api/v1/admin/data — wipe all usage data (owner+ only) */
admin.delete('/data', requireAdmin, (c) => {
  const deletedCount = truncateUsageEntries();
  return c.json({ ok: true, deletedCount });
});

/** DELETE /api/v1/admin/developers/:developerId/data — wipe one member's usage data */
admin.delete('/developers/:developerId/data', requireAdmin, (c) => {
  const { developerId } = c.req.param();
  const user = findUserById(developerId);
  const resolvedDeveloperId = user ? user.developer_id : developerId;
  const deletedCount = deleteUsageEntriesForDeveloper(resolvedDeveloperId);
  return c.json({ ok: true, deletedCount });
});

/** GET /api/v1/admin/developers/:developerId/machines — per-machine stats for a member */
admin.get('/developers/:developerId/machines', requireAdmin, (c) => {
  const developerId = c.req.param('developerId') as string;
  const stats = getMachineStatsForDeveloper(developerId);
  return c.json(stats);
});

/** DELETE /api/v1/admin/api-keys/:id/data — wipe one machine's usage data */
admin.delete('/api-keys/:id/data', requireAdmin, (c) => {
  const id = c.req.param('id') as string;
  const deletedCount = deleteUsageEntriesForApiKey(id);
  return c.json({ ok: true, deletedCount });
});

/** GET /api/v1/admin/cost-comparison — org-wide cost comparison (no developer scoping). */
admin.get('/cost-comparison', (c) => {
  const rangeParam = c.req.query('range') ?? '24h';
  const range: TimeRange = VALID_RANGES.has(rangeParam) ? (rangeParam as TimeRange) : '24h';
  const tiers = getAggregateTokensByTier(range, parseScope(c)); // optional org/workspace scope

  const opusComparisons = computeComparisonCosts({
    inputTokens: tiers.opus.inputTokens,
    outputTokens: tiers.opus.outputTokens,
    cacheCreationTokens: tiers.opus.cacheCreationTokens,
    cacheReadTokens: tiers.opus.cacheReadTokens,
  }).filter((entry) => entry.tier === 'opus');

  const sonnetComparisons = computeComparisonCosts({
    inputTokens: tiers.sonnet.inputTokens,
    outputTokens: tiers.sonnet.outputTokens,
    cacheCreationTokens: tiers.sonnet.cacheCreationTokens,
    cacheReadTokens: tiers.sonnet.cacheReadTokens,
  }).filter((entry) => entry.tier === 'sonnet');

  return c.json({
    opus: {
      tokens: {
        inputTokens: tiers.opus.inputTokens,
        outputTokens: tiers.opus.outputTokens,
        cacheCreationTokens: tiers.opus.cacheCreationTokens,
        cacheReadTokens: tiers.opus.cacheReadTokens,
        totalTokens: tiers.opus.inputTokens + tiers.opus.outputTokens + tiers.opus.cacheCreationTokens + tiers.opus.cacheReadTokens,
      },
      actualCost: tiers.opus.actualCost,
      comparisons: opusComparisons,
    },
    sonnet: {
      tokens: {
        inputTokens: tiers.sonnet.inputTokens,
        outputTokens: tiers.sonnet.outputTokens,
        cacheCreationTokens: tiers.sonnet.cacheCreationTokens,
        cacheReadTokens: tiers.sonnet.cacheReadTokens,
        totalTokens: tiers.sonnet.inputTokens + tiers.sonnet.outputTokens + tiers.sonnet.cacheCreationTokens + tiers.sonnet.cacheReadTokens,
      },
      actualCost: tiers.sonnet.actualCost,
      comparisons: sonnetComparisons,
    },
  });
});

// ── Organizations (Phase 3a) ─────────────────────────────────────────────

/** GET /api/v1/admin/organizations — list all orgs (Platform admin sees all). */
admin.get('/organizations', (c) => {
  return c.json(listOrganizations());
});

/** POST /api/v1/admin/organizations — create. Body: { name } */
admin.post('/organizations', async (c) => {
  const auth = c.get('auth') as AuthContext | undefined;
  if (!auth) return c.json({ error: 'Auth required' }, 401);
  const body = await c.req.json() as { name?: string };
  if (!body.name || !body.name.trim()) {
    return c.json({ error: 'Name is required' }, 400);
  }
  const id = randomUUID();
  const org = createOrganization({ id, name: body.name.trim() });
  writeAudit({ id: randomUUID(), actorId: auth.userId, targetId: auth.userId, action: 'create_organization', scopeId: id, scopeType: 'org' });
  return c.json(org, 201);
});

/** PATCH /api/v1/admin/organizations/:id — rename. Body: { name } */
admin.patch('/organizations/:id', async (c) => {
  const auth = c.get('auth') as AuthContext | undefined;
  if (!auth) return c.json({ error: 'Auth required' }, 401);
  const id = c.req.param('id');
  const body = await c.req.json() as { name?: string };
  if (!body.name || !body.name.trim()) {
    return c.json({ error: 'Name is required' }, 400);
  }
  const org = updateOrganization(id, { name: body.name.trim() });
  if (!org) return c.json({ error: 'Organization not found' }, 404);
  writeAudit({ id: randomUUID(), actorId: auth.userId, targetId: auth.userId, action: 'rename_organization', scopeId: id, scopeType: 'org' });
  return c.json(org);
});

/** DELETE /api/v1/admin/organizations/:id — delete (refuses if non-empty). */
admin.delete('/organizations/:id', (c) => {
  const auth = c.get('auth') as AuthContext | undefined;
  if (!auth) return c.json({ error: 'Auth required' }, 401);
  const id = c.req.param('id');
  if (id === 'default') {
    return c.json({ error: 'Cannot delete the default organization' }, 400);
  }
  const result = deleteOrganization(id);
  if (!result.ok) return c.json({ error: result.reason }, 409);
  writeAudit({ id: randomUUID(), actorId: auth.userId, targetId: auth.userId, action: 'delete_organization', scopeId: id, scopeType: 'org' });
  return c.json({ ok: true });
});

// ── Workspaces (Phase 3a) ────────────────────────────────────────────────

/** GET /api/v1/admin/organizations/:orgId/workspaces — list workspaces in an org. */
admin.get('/organizations/:orgId/workspaces', (c) => {
  return c.json(listWorkspaces(c.req.param('orgId')));
});

/** POST /api/v1/admin/organizations/:orgId/workspaces — create. Body: { name } */
admin.post('/organizations/:orgId/workspaces', async (c) => {
  const auth = c.get('auth') as AuthContext | undefined;
  if (!auth) return c.json({ error: 'Auth required' }, 401);
  const orgId = c.req.param('orgId');
  const org = findOrganizationById(orgId);
  if (!org) return c.json({ error: 'Organization not found' }, 404);
  const body = await c.req.json() as { name?: string };
  if (!body.name || !body.name.trim()) {
    return c.json({ error: 'Name is required' }, 400);
  }
  const id = randomUUID();
  const ws = createWorkspace({ id, orgId, name: body.name.trim() });
  writeAudit({ id: randomUUID(), actorId: auth.userId, targetId: auth.userId, action: 'create_workspace', scopeId: id, scopeType: 'workspace' });
  return c.json(ws, 201);
});

/** PATCH /api/v1/admin/workspaces/:id — rename. Body: { name } */
admin.patch('/workspaces/:id', async (c) => {
  const auth = c.get('auth') as AuthContext | undefined;
  if (!auth) return c.json({ error: 'Auth required' }, 401);
  const id = c.req.param('id');
  const body = await c.req.json() as { name?: string };
  if (!body.name || !body.name.trim()) {
    return c.json({ error: 'Name is required' }, 400);
  }
  const ws = updateWorkspace(id, { name: body.name.trim() });
  if (!ws) return c.json({ error: 'Workspace not found' }, 404);
  writeAudit({ id: randomUUID(), actorId: auth.userId, targetId: auth.userId, action: 'rename_workspace', scopeId: id, scopeType: 'workspace' });
  return c.json(ws);
});

/** DELETE /api/v1/admin/workspaces/:id — delete (refuses if non-empty). */
admin.delete('/workspaces/:id', (c) => {
  const auth = c.get('auth') as AuthContext | undefined;
  if (!auth) return c.json({ error: 'Auth required' }, 401);
  const id = c.req.param('id');
  if (id === 'default-ws') {
    return c.json({ error: 'Cannot delete the default workspace' }, 400);
  }
  const result = deleteWorkspace(id);
  if (!result.ok) return c.json({ error: result.reason }, 409);
  writeAudit({ id: randomUUID(), actorId: auth.userId, targetId: auth.userId, action: 'delete_workspace', scopeId: id, scopeType: 'workspace' });
  return c.json({ ok: true });
});

// ── Members (Phase 3b) ───────────────────────────────────────────────────

/**
 * GET /api/v1/admin/members
 *   List all users with their current org/workspace, optionally filtered
 *   by active org/workspace from the top-bar scope.
 *
 *   ?orgId=…&workspaceId=… filters to members whose ACTIVE memberships
 *   match. Members with no active membership are only shown when no
 *   filter is provided.
 */
admin.get('/members', (c) => {
  const orgId = c.req.query('orgId');
  const workspaceId = c.req.query('workspaceId');
  const users = listUsers();
  return c.json(
    users
      .map((u) => {
        const org = getActiveOrgMembership(u.id);
        const ws = getActiveWorkspaceMembership(u.id);
        return {
          id: u.id,
          email: u.email,
          displayName: u.display_name,
          role: u.role,
          developerId: u.developer_id,
          createdAt: u.created_at,
          currentOrgId: org?.orgId ?? null,
          currentWorkspaceId: ws?.workspaceId ?? null,
        };
      })
      .filter((m) => {
        if (orgId && m.currentOrgId !== orgId) return false;
        if (workspaceId && m.currentWorkspaceId !== workspaceId) return false;
        return true;
      }),
  );
});

/**
 * POST /api/v1/admin/users/:id/move
 *   Body: { orgId, workspaceId }
 *   Closes active memberships, opens new ones.
 *   Past usage_entries are not retouched — historical attribution stays.
 */
admin.post('/users/:id/move', async (c) => {
  const auth = c.get('auth') as AuthContext | undefined;
  if (!auth) return c.json({ error: 'Auth required' }, 401);
  const userId = c.req.param('id');
  const body = await c.req.json() as { orgId?: string; workspaceId?: string };
  if (!body.orgId || !body.workspaceId) {
    return c.json({ error: 'orgId and workspaceId are required' }, 400);
  }
  const target = findUserById(userId);
  if (!target) return c.json({ error: 'User not found' }, 404);
  const org = findOrganizationById(body.orgId);
  if (!org) return c.json({ error: 'Organization not found' }, 404);
  const ws = findWorkspaceById(body.workspaceId);
  if (!ws) return c.json({ error: 'Workspace not found' }, 404);
  if (ws.orgId !== org.id) {
    return c.json({ error: 'Workspace does not belong to the chosen organization' }, 400);
  }

  assignUserToWorkspace(userId, body.orgId, body.workspaceId);
  writeAudit({
    id: randomUUID(),
    actorId: auth.userId,
    targetId: userId,
    action: 'move_user',
    scopeId: body.workspaceId,
    scopeType: 'workspace',
  });
  return c.json({ ok: true });
});

// ── Audit log (Phase 3a stub; full UI in 3c) ─────────────────────────────

admin.get('/role-audit', (c) => {
  const limit = Math.min(Math.max(parseInt(c.req.query('limit') ?? '100', 10) || 100, 1), 500);
  return c.json(listRoleAudit(limit));
});

export { admin as adminRoutes };
