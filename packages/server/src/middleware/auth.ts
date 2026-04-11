import type { Next } from 'hono';
import { sign, verify } from 'hono/utils/jwt/jwt';
import type { AuthContext, UserRole } from '@claude-usage-hub/shared';
import { JWT_EXPIRATION_SECONDS, isAdminRole } from '@claude-usage-hub/shared';
import { findApiKeyByHash, findUserById } from '../db/auth-repository.js';
import { hashApiKey } from '../services/auth-utils.js';
import type { AppEnv } from '../env.js';

type Context = import('hono').Context<AppEnv>;

let jwtSecret: string | null = null;
let googleClientId: string | null = null;
let allowedDomain: string | null = null;

/** Set the JWT secret (called once at startup in team mode). */
export function setJwtSecret(secret: string): void {
  jwtSecret = secret;
}

/** Set the Google OAuth config (called once at startup in team mode). */
export function setGoogleConfig(clientId: string, domain: string): void {
  googleClientId = clientId;
  allowedDomain = domain;
}

/** Get the Google OAuth config. Throws if not set. */
export function getGoogleConfig(): { clientId: string; allowedDomain: string } {
  if (!googleClientId || !allowedDomain) throw new Error('Google OAuth not configured');
  return { clientId: googleClientId, allowedDomain };
}

/** Get the JWT secret. Throws if not set. */
function getSecret(): string {
  if (!jwtSecret) throw new Error('JWT secret not configured');
  return jwtSecret;
}

/**
 * Sign a JWT token for a user.
 */
export async function signJwt(user: {
  id: string;
  email: string;
  role: UserRole;
  developerId: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  // Use plain object for Hono JWT compatibility (JWTPayload needs index signature)
  const payload: Record<string, unknown> = {
    sub: user.id,
    email: user.email,
    role: user.role,
    developerId: user.developerId,
    iat: now,
    exp: now + JWT_EXPIRATION_SECONDS,
  };
  return sign(payload, getSecret());
}

/**
 * API key authentication middleware.
 * Reads X-API-Key header, validates against database.
 */
export async function apiKeyAuth(c: Context, next: Next): Promise<void | Response> {
  const key = c.req.header('X-API-Key');
  if (!key) {
    return c.json({ error: 'Missing X-API-Key header' }, 401);
  }

  const keyHash = hashApiKey(key);
  const apiKey = findApiKeyByHash(keyHash);
  if (!apiKey) {
    return c.json({ error: 'Invalid or revoked API key' }, 401);
  }

  // Look up the user to get their role and email
  const user = findUserById(apiKey.user_id);
  const auth: AuthContext = {
    userId: apiKey.user_id,
    email: user?.email ?? '',
    role: (user?.role as UserRole) ?? 'developer',
    developerId: apiKey.developer_id,
  };
  c.set('auth', auth);
  await next();
}

/**
 * JWT authentication middleware.
 * Reads Authorization: Bearer <token> header.
 */
export async function jwtAuth(c: Context, next: Next): Promise<void | Response> {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  const token = authHeader.slice(7);
  try {
    const payload = (await verify(token, getSecret(), 'HS256')) as unknown as {
      sub: string;
      email: string;
      role: UserRole;
      developerId: string;
    };

    // Verify user still exists
    const user = findUserById(payload.sub);
    if (!user) {
      return c.json({ error: 'User no longer exists' }, 401);
    }

    const auth: AuthContext = {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      developerId: payload.developerId,
    };
    c.set('auth', auth);
    await next();
  } catch {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
}

/**
 * Admin-only guard (primary_owner or owner). Must be used after jwtAuth.
 */
export async function requireAdmin(c: Context, next: Next): Promise<void | Response> {
  const auth = c.get('auth') as AuthContext | undefined;
  if (!auth || !isAdminRole(auth.role)) {
    return c.json({ error: 'Admin access required' }, 403);
  }
  await next();
}

/**
 * Primary owner guard. Must be used after jwtAuth.
 */
export async function requirePrimaryOwner(c: Context, next: Next): Promise<void | Response> {
  const auth = c.get('auth') as AuthContext | undefined;
  if (!auth || auth.role !== 'primary_owner') {
    return c.json({ error: 'Primary owner access required' }, 403);
  }
  await next();
}
