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
  const body = await c.req.json() as { email?: string };

  if (!body.email) {
    return c.json({ error: 'email is required' }, 400);
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

  createInvitation({ id, email: body.email, tokenHash, invitedBy: auth.userId, expiresAt });

  // Return the invite URL — admin copies this and shares via chat/Slack
  const origin = new URL(c.req.url).origin;
  const inviteUrl = `${origin}/invite/accept?token=${token}`;

  return c.json({ id, email: body.email, inviteUrl, expiresAt }, 201);
});

/** GET /api/v1/admin/invitations — list all invitations */
invitations.get('/', (c) => {
  const rows = listInvitations();
  return c.json(
    rows.map((r) => ({
      id: r.id,
      email: r.email,
      invitedBy: r.invited_by,
      createdAt: r.created_at,
      expiresAt: r.expires_at,
      acceptedAt: r.accepted_at,
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
  } else if (!user.google_id) {
    updateUserGoogleId(user.id, googleUser.sub);
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
