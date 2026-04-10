import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { createApiKeySchema, createDeveloperSchema } from '@claude-usage-hub/shared';
import type { AppEnv } from '../env.js';
import {
  createUser,
  listUsers,
  findUserByEmail,
  findUserById,
  createApiKey,
  listApiKeys,
  revokeApiKey,
} from '../db/auth-repository.js';
import { hashPassword, generateApiKey } from '../services/auth-utils.js';

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

export { admin as adminRoutes };
