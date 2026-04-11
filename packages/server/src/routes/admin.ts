import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { createApiKeySchema, createDeveloperSchema } from '@claude-usage-hub/shared';
import type { AppEnv } from '../env.js';
import type { AuthContext } from '@claude-usage-hub/shared';
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
import { getDeveloperStats, getDashboardStats, getTokenTimeseries } from '../db/repository.js';
import { requireAdmin, requirePrimaryOwner } from '../middleware/auth.js';

const admin = new Hono<AppEnv>();

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

  if (!body.role || !['owner', 'developer'].includes(body.role)) {
    return c.json({ error: 'Invalid role. Must be "owner" or "developer".' }, 400);
  }

  const target = findUserById(targetId);
  if (!target) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Cannot change a primary_owner's role
  if (target.role === 'primary_owner') {
    return c.json({ error: 'Cannot change the role of a primary owner.' }, 403);
  }

  const updated = updateUserRole(targetId, body.role);
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
  return c.json(getDeveloperStats());
});

/** GET /api/v1/admin/stats/overview — org-wide totals */
admin.get('/stats/overview', (c) => {
  const range = (c.req.query('range') as 'all' | '7d' | '30d' | '24h' | '5h') ?? 'all';
  const validRanges = new Set(['5h', '24h', '7d', '30d', 'all']);
  const safeRange = validRanges.has(range) ? range : 'all';
  return c.json(getDashboardStats(safeRange as import('@claude-usage-hub/shared').TimeRange));
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

export { admin as adminRoutes };
