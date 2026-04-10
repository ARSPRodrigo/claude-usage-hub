import { Hono } from 'hono';
import { loginRequestSchema } from '@claude-usage-hub/shared';
import type { AuthContext } from '@claude-usage-hub/shared';
import type { AppEnv } from '../env.js';
import { findUserByEmail, findUserById } from '../db/auth-repository.js';
import { verifyPassword } from '../services/auth-utils.js';
import { signJwt, jwtAuth } from '../middleware/auth.js';

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
