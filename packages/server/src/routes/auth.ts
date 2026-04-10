import { Hono } from 'hono';
import { randomUUID } from 'node:crypto';
import { loginRequestSchema } from '@claude-usage-hub/shared';
import type { AuthContext } from '@claude-usage-hub/shared';
import type { AppEnv } from '../env.js';
import {
  findUserByEmail,
  findUserById,
  findUserByGoogleId,
  createUser,
  updateUserGoogleId,
} from '../db/auth-repository.js';
import { verifyPassword } from '../services/auth-utils.js';
import { verifyGoogleToken } from '../services/google-auth.js';
import { signJwt, jwtAuth, getGoogleConfig } from '../middleware/auth.js';

const auth = new Hono<AppEnv>();

/** POST /auth/login — authenticate and return JWT. */
auth.post('/login', async (c) => {
  const body = await c.req.json();
  const parsed = loginRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid request: ' + parsed.error.message }, 400);
  }

  const { email, password } = parsed.data;
  const user = findUserByEmail(email);
  if (!user) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  if (!verifyPassword(password, user.password_hash)) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const token = await signJwt({
    id: user.id,
    email: user.email,
    role: user.role as 'admin' | 'developer',
    developerId: user.developer_id,
  });

  return c.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      role: user.role,
      developerId: user.developer_id,
    },
  });
});

/**
 * POST /auth/google/verify — verify a Google ID token and return a JWT.
 *
 * Flow: frontend receives Google ID token → sends here → server verifies
 * signature + domain → finds/creates user → returns our own JWT.
 */
auth.post('/google/verify', async (c) => {
  const body = await c.req.json() as { idToken?: string };
  if (!body.idToken) {
    return c.json({ error: 'idToken is required' }, 400);
  }

  let googleConfig: { clientId: string; allowedDomain: string };
  try {
    googleConfig = getGoogleConfig();
  } catch {
    return c.json({ error: 'Google OAuth is not configured on this server' }, 503);
  }

  let googleUser: Awaited<ReturnType<typeof verifyGoogleToken>>;
  try {
    googleUser = await verifyGoogleToken(body.idToken, googleConfig.clientId, googleConfig.allowedDomain);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Token verification failed' }, 401);
  }

  // Find existing user by Google ID first, then fall back to email
  let user = findUserByGoogleId(googleUser.sub);
  if (!user) {
    user = findUserByEmail(googleUser.email);
    if (user) {
      // Link Google ID to existing email account
      updateUserGoogleId(user.id, googleUser.sub);
    }
  }

  // Create new user if not found
  if (!user) {
    const id = randomUUID();
    const developerId = `dev-${id.slice(0, 8)}`;
    createUser({
      id,
      email: googleUser.email,
      displayName: googleUser.name,
      role: 'developer',
      developerId,
      googleId: googleUser.sub,
    });
    user = findUserById(id)!;
  }

  const token = await signJwt({
    id: user.id,
    email: user.email,
    role: user.role as 'admin' | 'developer',
    developerId: user.developer_id,
  });

  return c.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      role: user.role,
      developerId: user.developer_id,
    },
  });
});

/** POST /auth/logout — stateless JWT, client discards token. */
auth.post('/logout', (c) => {
  return c.json({ ok: true });
});

/** GET /auth/me — return current user info. Requires JWT. */
auth.get('/me', jwtAuth, async (c) => {
  const authCtx = c.get('auth') as AuthContext;
  const user = findUserById(authCtx.userId);
  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  return c.json({
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    role: user.role,
    developerId: user.developer_id,
  });
});

export { auth as authRoutes };
