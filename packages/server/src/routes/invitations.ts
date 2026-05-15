/**
 * Invitation routes — admin creates invite links, members accept them.
 *
 * Flow:
 *   Admin: POST /api/v1/admin/invitations → gets a one-time invite URL
 *   Member: visits /invite/accept?token=xxx → Google sign-in → account + API key created
 *   Member: POST /auth/invite/accept { token, idToken } → returns JWT + API key
 */

import { Hono } from 'hono';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import type { AppEnv } from '../env.js';
import type { AuthContext, UserRole } from '@claude-usage-hub/shared';
import {
  createInvitation,
  findInvitationByTokenHash,
  markInvitationAccepted,
  deleteInvitation,
  listInvitations,
} from '../db/invitation-repository.js';
import {
  findUserByEmail,
  findUserByGoogleId,
  findUserById,
  createUser,
  updateUserGoogleId,
  createApiKey,
} from '../db/auth-repository.js';
import { verifyGoogleToken } from '../services/google-auth.js';
import { generateApiKey } from '../services/auth-utils.js';
import { signJwt, getGoogleConfig } from '../middleware/auth.js';
import {
  findOrganizationById,
  findWorkspaceById,
  assignUserToWorkspace,
} from '../db/org-repository.js';

const invitations = new Hono<AppEnv>();

const INVITE_EXPIRY_DAYS = 7;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// ---------------------------------------------------------------------------
// Admin — create / list / revoke invitations
// ---------------------------------------------------------------------------

/** POST /api/v1/admin/invitations — create a new invitation link */
invitations.post('/', async (c) => {
  const auth = c.get('auth') as AuthContext;
  const body = await c.req.json() as { email?: string; role?: string; orgId?: string; workspaceId?: string };

  if (!body.email) {
    return c.json({ error: 'email is required' }, 400);
  }
  if (body.email.length > 254) {
    return c.json({ error: 'email is too long' }, 400);
  }

  // Accept legacy 'owner' and new 'platform_admin'; normalise to new vocabulary.
  const role = (body.role === 'owner' || body.role === 'platform_admin') ? 'platform_admin' : 'developer';

  // Validate org/workspace if provided.
  const orgId = body.orgId ?? null;
  const workspaceId = body.workspaceId ?? null;
  if (orgId && !findOrganizationById(orgId)) {
    return c.json({ error: 'Organization not found' }, 400);
  }
  if (workspaceId) {
    const ws = findWorkspaceById(workspaceId);
    if (!ws) return c.json({ error: 'Workspace not found' }, 400);
    if (orgId && ws.orgId !== orgId) {
      return c.json({ error: 'Workspace does not belong to the chosen organization' }, 400);
    }
  }

  // Check if already a registered user
  const existingUser = findUserByEmail(body.email);
  if (existingUser) {
    return c.json({ error: 'A user with this email already exists' }, 409);
  }

  const token = randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const id = randomUUID();
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  createInvitation({
    id, email: body.email, tokenHash, invitedBy: auth.userId, expiresAt, role,
    orgId, workspaceId,
  });

  // Return the invite URL — admin copies this and shares via chat/Slack
  const origin = new URL(c.req.url).origin;
  const inviteUrl = `${origin}/invite/accept?token=${token}`;

  return c.json({ id, email: body.email, inviteUrl, expiresAt, role, orgId, workspaceId }, 201);
});

/**
 * POST /api/v1/admin/invitations/bulk
 *   Body: { invites: [{ email, orgId?, workspaceId?, role? }] }
 *   Returns: { results: [{ email, inviteUrl?, error?, expiresAt? }] }
 *
 *   Processes each row independently — one bad email doesn't fail the batch.
 *   Reuses the single-invite logic so validation rules stay consistent.
 */
invitations.post('/bulk', async (c) => {
  const auth = c.get('auth') as AuthContext;
  const body = await c.req.json() as {
    invites?: Array<{ email?: string; orgId?: string; workspaceId?: string; role?: string }>;
  };

  if (!Array.isArray(body.invites) || body.invites.length === 0) {
    return c.json({ error: 'invites array is required and must be non-empty' }, 400);
  }
  if (body.invites.length > 500) {
    return c.json({ error: 'cannot create more than 500 invitations in one request' }, 400);
  }

  const origin = new URL(c.req.url).origin;

  const results = body.invites.map((row) => {
    const email = (row.email ?? '').trim().toLowerCase();
    if (!email) return { email: row.email ?? '', error: 'email is required' };
    if (email.length > 254) return { email, error: 'email is too long' };

    const role = (row.role === 'owner' || row.role === 'platform_admin') ? 'platform_admin' : 'developer';
    const orgId = row.orgId ?? null;
    const workspaceId = row.workspaceId ?? null;

    if (orgId && !findOrganizationById(orgId)) return { email, error: 'Organization not found' };
    if (workspaceId) {
      const ws = findWorkspaceById(workspaceId);
      if (!ws) return { email, error: 'Workspace not found' };
      if (orgId && ws.orgId !== orgId) return { email, error: 'Workspace does not belong to the chosen organization' };
    }
    if (findUserByEmail(email)) return { email, error: 'A user with this email already exists' };

    const token = randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);
    const id = randomUUID();
    const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

    try {
      createInvitation({
        id, email, tokenHash, invitedBy: auth.userId, expiresAt, role,
        orgId, workspaceId,
      });
    } catch (err) {
      return { email, error: err instanceof Error ? err.message : 'Failed to create invitation' };
    }

    return { email, inviteUrl: `${origin}/invite/accept?token=${token}`, expiresAt, role, orgId, workspaceId };
  });

  return c.json({ results });
});

/** GET /api/v1/admin/invitations — list all invitations, optionally filtered by org/workspace */
invitations.get('/', (c) => {
  const orgId = c.req.query('orgId');
  const workspaceId = c.req.query('workspaceId');
  const rows = listInvitations();
  return c.json(
    rows
      .filter((r) => {
        if (orgId && r.org_id !== orgId) return false;
        if (workspaceId && r.workspace_id !== workspaceId) return false;
        return true;
      })
      .map((r) => ({
        id: r.id,
        email: r.email,
        invitedBy: r.invited_by,
        createdAt: r.created_at,
        expiresAt: r.expires_at,
        acceptedAt: r.accepted_at,
        role: r.role ?? 'developer',
        orgId: r.org_id ?? null,
        workspaceId: r.workspace_id ?? null,
        status: r.accepted_at ? 'accepted' : new Date(r.expires_at) < new Date() ? 'expired' : 'pending',
      })),
  );
});

/** DELETE /api/v1/admin/invitations/:id — revoke an invitation */
invitations.delete('/:id', (c) => {
  const deleted = deleteInvitation(c.req.param('id'));
  if (!deleted) return c.json({ error: 'Invitation not found' }, 404);
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Member — accept invitation (called from the accept page after Google sign-in)
// ---------------------------------------------------------------------------

/** POST /auth/invite/accept — exchange invite token + Google ID token for JWT + API key */
export async function acceptInvite(c: import('hono').Context<AppEnv>): Promise<Response> {
  const body = await c.req.json() as { token?: string; idToken?: string; label?: string };

  if (!body.token || !body.idToken) {
    return c.json({ error: 'token and idToken are required' }, 400);
  }

  // Verify the invite token
  const tokenHash = hashToken(body.token);
  const invitation = findInvitationByTokenHash(tokenHash);

  if (!invitation) {
    return c.json({ error: 'Invalid invitation link' }, 400);
  }
  if (invitation.accepted_at) {
    return c.json({ error: 'This invitation has already been used' }, 400);
  }
  if (new Date(invitation.expires_at) < new Date()) {
    return c.json({ error: 'This invitation has expired' }, 400);
  }

  // Verify Google ID token
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

  // Email must match the invitation
  if (googleUser.email !== invitation.email) {
    return c.json(
      { error: `Please sign in with the invited email address (${invitation.email})` },
      403,
    );
  }

  // Find or create the user
  let user = findUserByGoogleId(googleUser.sub) ?? findUserByEmail(googleUser.email);
  const isNewUser = !user;
  if (!user) {
    const id = randomUUID();
    const developerId = `dev-${id.slice(0, 8)}`;
    createUser({
      id,
      email: googleUser.email,
      displayName: googleUser.name,
      role: (invitation.role ?? 'developer') as UserRole,
      developerId,
      googleId: googleUser.sub,
    });
    user = findUserById(id)!;
  } else if (!user.google_id) {
    updateUserGoogleId(user.id, googleUser.sub);
  }

  // Assign org/workspace memberships. If the invite specified a target,
  // route the user there. Otherwise default to 'default' org/workspace.
  const targetOrgId = invitation.org_id ?? 'default';
  const targetWorkspaceId = invitation.workspace_id ?? 'default-ws';
  // For new users (and existing users without an active membership): always set.
  // For existing users with an active membership: only override if the invite
  // explicitly specified a target (don't silently move them).
  const shouldAssign = isNewUser || invitation.org_id !== null || invitation.workspace_id !== null;
  if (shouldAssign) {
    assignUserToWorkspace(user.id, targetOrgId, targetWorkspaceId);
  }

  // Generate initial API key for this machine
  const { key, keyHash, keyPrefix } = generateApiKey();
  const keyId = randomUUID();
  const label = body.label ?? 'My machine';

  createApiKey({
    id: keyId,
    userId: user.id,
    keyPrefix,
    keyHash,
    label,
    developerId: user.developer_id,
  });

  // Mark invitation as used
  markInvitationAccepted(invitation.id);

  const token = await signJwt({
    id: user.id,
    email: user.email,
    role: user.role as UserRole,
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
    apiKey: {
      id: keyId,
      key,       // shown once — member must save it
      keyPrefix,
      label,
      developerId: user.developer_id,
    },
  });
}

export { invitations as invitationRoutes };
