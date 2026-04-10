/**
 * Profile routes — authenticated developer manages their own API keys.
 */
import { Hono } from 'hono';
import { randomUUID } from 'node:crypto';
import type { AppEnv } from '../env.js';
import type { AuthContext } from '@claude-usage-hub/shared';
import {
  listApiKeysForUser,
  createApiKey,
  revokeApiKeyForUser,
} from '../db/auth-repository.js';
import { generateApiKey } from '../services/auth-utils.js';

const profile = new Hono<AppEnv>();

/** GET /api/v1/profile/api-keys — list own API keys */
profile.get('/api-keys', (c) => {
  const auth = c.get('auth') as AuthContext;
  const keys = listApiKeysForUser(auth.userId);
  return c.json(
    keys.map((k) => ({
      id: k.id,
      keyPrefix: k.key_prefix,
      label: k.label,
      developerId: k.developer_id,
      createdAt: k.created_at,
      revokedAt: k.revoked_at,
    })),
  );
});

/** POST /api/v1/profile/api-keys — generate a new API key for another machine */
profile.post('/api-keys', async (c) => {
  const auth = c.get('auth') as AuthContext;
  const body = await c.req.json() as { label?: string };

  if (!body.label?.trim()) {
    return c.json({ error: 'label is required' }, 400);
  }

  const id = randomUUID();
  const { key, keyHash, keyPrefix } = generateApiKey();

  createApiKey({
    id,
    userId: auth.userId,
    keyPrefix,
    keyHash,
    label: body.label.trim(),
    developerId: auth.developerId,
  });

  return c.json({ id, key, keyPrefix, label: body.label.trim(), developerId: auth.developerId }, 201);
});

/** DELETE /api/v1/profile/api-keys/:id — revoke own API key */
profile.delete('/api-keys/:id', (c) => {
  const auth = c.get('auth') as AuthContext;
  const revoked = revokeApiKeyForUser(c.req.param('id'), auth.userId);
  if (!revoked) return c.json({ error: 'API key not found or already revoked' }, 404);
  return c.json({ ok: true });
});

export { profile as profileRoutes };
