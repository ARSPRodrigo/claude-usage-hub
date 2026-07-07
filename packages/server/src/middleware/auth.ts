import type { Next } from 'hono';
import { sign, verify } from 'hono/utils/jwt/jwt';
import type { AuthContext, UserRole } from '@claude-usage-hub/shared';
import { JWT_EXPIRATION_SECONDS, isPlatformAdminRole, isPlatformOwnerRole, isWorkspaceAdminRole } from '@claude-usage-hub/shared';
import { findApiKeyByHash, findUserById, updateApiKeyLastUsed } from '../db/auth-repository.js';
import {
  getActiveOrgMembership,
  getActiveWorkspaceMembership,
  listOwnedOrgIds,
  listOwnedWorkspaceIds,
  findWorkspaceById,
} from '../db/org-repository.js';
import { hashApiKey } from '../services/auth-utils.js';
import type { AppEnv } from '../env.js';

type Context = import('hono').Context<AppEnv>;

let jwtSecret: string | null = null;
let googleClientId: string | null = null;
let allowedDomains: string[] = [];

/** Set the JWT secret (called once at startup in team mode). */
export function setJwtSecret(secret: string): void {
  jwtSecret = secret;
}

/** Set the Google OAuth config (called once at startup in team mode). */
export function setGoogleConfig(clientId: string, domains: string[]): void {
  googleClientId = clientId;
  allowedDomains = domains;
}

/** Get the Google OAuth config. Throws if not set. */
export function getGoogleConfig(): { clientId: string; allowedDomains: string[] } {
  if (!googleClientId || allowedDomains.length === 0) throw new Error('Google OAuth not configured');
  return { clientId: googleClientId, allowedDomains };
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
 * Enrich an AuthContext with active org/workspace membership + owned scopes.
 * Looked up per-request rather than baked into the JWT — keeps tokens valid
 * across membership changes.
 */
function enrichAuth(auth: AuthContext): AuthContext {
  const orgMembership = getActiveOrgMembership(auth.userId);
  const wsMembership = getActiveWorkspaceMembership(auth.userId);
  return {
    ...auth,
    activeOrgId: orgMembership?.orgId ?? null,
    activeWorkspaceId: wsMembership?.workspaceId ?? null,
    ownedOrgIds: listOwnedOrgIds(auth.userId),
    ownedWorkspaceIds: listOwnedWorkspaceIds(auth.userId),
  };
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

  // Track last usage (fire-and-forget, best effort)
  updateApiKeyLastUsed(keyHash);

  // Look up the user to get their role and email
  const user = findUserById(apiKey.user_id);
  const baseAuth: AuthContext = {
    userId: apiKey.user_id,
    email: user?.email ?? '',
    role: (user?.role as UserRole) ?? 'developer',
    developerId: apiKey.developer_id,
    apiKeyId: apiKey.id,
  };
  c.set('auth', enrichAuth(baseAuth));
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

    const baseAuth: AuthContext = {
      userId: payload.sub,
      email: payload.email,
      // Prefer DB role over JWT role — caters to role changes since token issuance.
      role: (user.role as UserRole) ?? payload.role,
      developerId: payload.developerId,
    };
    c.set('auth', enrichAuth(baseAuth));
    await next();
  } catch {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
}

/**
 * Platform-admin guard (platform_owner or platform_admin; legacy primary_owner/owner accepted).
 * Must be used after jwtAuth.
 */
export async function requirePlatformAdmin(c: Context, next: Next): Promise<void | Response> {
  const auth = c.get('auth') as AuthContext | undefined;
  if (!auth || !isPlatformAdminRole(auth.role)) {
    return c.json({ error: 'Platform admin access required' }, 403);
  }
  await next();
}

/**
 * Platform-owner guard (the singular owner; legacy primary_owner accepted).
 * Must be used after jwtAuth.
 */
export async function requirePlatformOwner(c: Context, next: Next): Promise<void | Response> {
  const auth = c.get('auth') as AuthContext | undefined;
  if (!auth || !isPlatformOwnerRole(auth.role)) {
    return c.json({ error: 'Platform owner access required' }, 403);
  }
  await next();
}

// ── Scope-check helpers (used by route handlers, not middleware) ─────────
// Platform admin: unrestricted. Org owner: limited to owned orgs and
// workspaces in those orgs. Workspace-only owners can act on their
// individual workspaces.

/** True if the auth context has platform_admin / platform_owner authority. */
export function isPlatformLike(auth: AuthContext | undefined): boolean {
  return !!auth && isPlatformAdminRole(auth.role);
}

export function canAccessOrg(auth: AuthContext | undefined, orgId: string): boolean {
  if (!auth) return false;
  if (isPlatformLike(auth)) return true;
  return (auth.ownedOrgIds ?? []).includes(orgId);
}

export function canAccessWorkspace(auth: AuthContext | undefined, wsId: string): boolean {
  if (!auth) return false;
  if (isPlatformLike(auth)) return true;
  const ws = findWorkspaceById(wsId);
  if (!ws) return false;
  if ((auth.ownedOrgIds ?? []).includes(ws.orgId)) return true;
  return (auth.ownedWorkspaceIds ?? []).includes(wsId);
}

/**
 * Returns the set of org IDs the caller can act on, or null for unrestricted
 * (platform-like) callers. workspace_admin has no org-level authority so their
 * set is empty — callers that need workspace-level filtering should use
 * accessibleWorkspaceIds instead.
 */
export function accessibleOrgIds(auth: AuthContext | undefined): Set<string> | null {
  if (!auth || isPlatformLike(auth)) return null;
  return new Set(auth.ownedOrgIds ?? []);
}

/**
 * Returns the set of workspace IDs the caller can act on, or null for
 * unrestricted (platform-like) callers. Primarily used by workspace_admin
 * to scope list endpoints to their owned workspaces.
 */
export function accessibleWorkspaceIds(auth: AuthContext | undefined): Set<string> | null {
  if (!auth || isPlatformLike(auth)) return null;
  return new Set(auth.ownedWorkspaceIds ?? []);
}

/**
 * Mount-level guard for /api/v1/admin/*. Lets through:
 *   - Platform admins / owners (full access)
 *   - workspace_admin with at least one workspace ownership grant
 *   - Any user with at least one org or workspace ownership grant
 * Per-route guards (`requirePlatformAdmin`, `requirePlatformOwner`) and
 * handler-level scope checks tighten access on individual endpoints.
 */
export async function requireAdminOrOwner(c: Context, next: Next): Promise<void | Response> {
  const auth = c.get('auth') as AuthContext | undefined;
  if (!auth) return c.json({ error: 'Auth required' }, 401);
  const isAdmin = isPlatformAdminRole(auth.role);
  const isWsAdmin = isWorkspaceAdminRole(auth.role) && (auth.ownedWorkspaceIds?.length ?? 0) > 0;
  const isOwner = (auth.ownedOrgIds?.length ?? 0) > 0 || (auth.ownedWorkspaceIds?.length ?? 0) > 0;
  if (!isAdmin && !isWsAdmin && !isOwner) {
    return c.json({ error: 'Admin or owner access required' }, 403);
  }
  await next();
}

/** @deprecated Use requirePlatformAdmin. Retained for callers mid-migration. */
export const requireAdmin = requirePlatformAdmin;
/** @deprecated Use requirePlatformOwner. */
export const requirePrimaryOwner = requirePlatformOwner;
