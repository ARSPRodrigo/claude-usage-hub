import { getRawDb } from './connection.js';

export interface InvitationRow {
  id: string;
  email: string;
  token_hash: string;
  invited_by: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
}

export function createInvitation(inv: {
  id: string;
  email: string;
  tokenHash: string;
  invitedBy: string;
  expiresAt: string;
}): void {
  const db = getRawDb();
  db.prepare(
    `INSERT INTO invitations (id, email, token_hash, invited_by, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(inv.id, inv.email, inv.tokenHash, inv.invitedBy, inv.expiresAt);
}

export function findInvitationByTokenHash(tokenHash: string): InvitationRow | null {
  const db = getRawDb();
  return (
    (db
      .prepare('SELECT * FROM invitations WHERE token_hash = ?')
      .get(tokenHash) as InvitationRow) ?? null
  );
}

export function findInvitationByEmail(email: string): InvitationRow | null {
  const db = getRawDb();
  return (
    (db
      .prepare('SELECT * FROM invitations WHERE email = ? ORDER BY created_at DESC LIMIT 1')
      .get(email) as InvitationRow) ?? null
  );
}

export function markInvitationAccepted(id: string): void {
  const db = getRawDb();
  db.prepare("UPDATE invitations SET accepted_at = datetime('now') WHERE id = ?").run(id);
}

export function deleteInvitation(id: string): boolean {
  const db = getRawDb();
  const result = db.prepare('DELETE FROM invitations WHERE id = ?').run(id);
  return result.changes > 0;
}

export function listInvitations(): InvitationRow[] {
  const db = getRawDb();
  return db
    .prepare('SELECT * FROM invitations ORDER BY created_at DESC')
    .all() as InvitationRow[];
}
