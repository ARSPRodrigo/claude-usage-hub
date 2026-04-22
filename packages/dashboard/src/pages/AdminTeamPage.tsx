import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiDelete, getUser } from '@/api/client';
import { Plus, Copy, Trash2 } from 'lucide-react';

interface Invitation {
  id: string;
  email: string;
  invitedBy: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  role: string;
  status: 'pending' | 'accepted' | 'expired';
}

interface Member {
  id: string;
  email: string;
  displayName: string;
  role: string;
  developerId: string;
  createdAt: string;
}

async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const url = new URL(path, window.location.origin);
  const token = localStorage.getItem('chub_token');
  const response = await fetch(url.toString(), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Server error ${response.status}: ${text || response.statusText}`);
  }
  return response.json() as Promise<T>;
}

function formatRelativeTime(ts: string): string {
  const diff = (Date.now() - new Date(ts).getTime()) / 1000;
  if (diff < 0) {
    const futureDays = Math.ceil(Math.abs(diff) / 86400);
    return `${futureDays}d`;
  }
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function expiresIn(ts: string): string {
  const diff = (new Date(ts).getTime() - Date.now()) / 1000;
  if (diff <= 0) return 'expired';
  const days = Math.ceil(diff / 86400);
  return `${days}d`;
}

export function AdminTeamPage() {
  const qc = useQueryClient();
  const currentUser = getUser();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'developer' | 'owner'>('developer');
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: invitations = [] } = useQuery({
    queryKey: ['admin-invitations'],
    queryFn: () => apiGet<Invitation[]>('/api/v1/admin/invitations'),
  });

  const { data: members = [] } = useQuery({
    queryKey: ['admin-members'],
    queryFn: () => apiGet<Member[]>('/api/v1/admin/developers'),
  });

  const createInvite = useMutation({
    mutationFn: ({ email, role }: { email: string; role: string }) =>
      apiPost<{ id: string; inviteUrl: string; email: string; expiresAt: string; role: string }>(
        '/api/v1/admin/invitations',
        { email, role },
      ),
    onSuccess: (data) => {
      setInviteUrl(data.inviteUrl);
      setInviteEmail('');
      void qc.invalidateQueries({ queryKey: ['admin-invitations'] });
    },
  });

  const revokeInvite = useMutation({
    mutationFn: (id: string) => apiDelete<{ ok: boolean }>(`/api/v1/admin/invitations/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-invitations'] }),
  });

  const changeRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      apiPatch<{ ok: boolean }>(`/api/v1/admin/developers/${id}/role`, { role }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-members'] }),
  });

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const pendingInvites = invitations.filter((inv) => inv.status === 'pending');

  return (
    <div>
      {/* Page header */}
      <div className="mb-6">
        <div className="label mb-2">ORGANIZATION · /TEAM</div>
        <h1 className="text-title m-0" style={{ fontSize: 36, lineHeight: 1.05 }}>Team</h1>
        <div className="text-ink-3 mt-2 text-sm">Invites, roles and API keys.</div>
      </div>

      {/* Pending invites card */}
      <div className="rounded-card border border-line bg-surface mb-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line-2">
          <div>
            <div className="text-[15px] font-medium">Pending invites</div>
            <div className="text-ink-3 text-[13px] mt-1">
              {pendingInvites.length} invite{pendingInvites.length !== 1 ? 's' : ''} outstanding.
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => { setInviteEmail(e.target.value); setInviteUrl(null); }}
              placeholder="name@example.com"
              className="px-3 py-1.5 text-[13px] rounded-btn border border-line bg-surface text-ink placeholder:text-ink-3 focus:outline-none w-52"
              onKeyDown={(e) => { if (e.key === 'Enter' && inviteEmail.trim()) createInvite.mutate({ email: inviteEmail.trim(), role: inviteRole }); }}
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as 'developer' | 'owner')}
              className="px-2 py-1.5 text-[13px] rounded-btn border border-line bg-surface text-ink"
            >
              <option value="developer">Developer</option>
              <option value="owner">Owner</option>
            </select>
            <button
              onClick={() => { if (inviteEmail.trim()) createInvite.mutate({ email: inviteEmail.trim(), role: inviteRole }); }}
              disabled={!inviteEmail.trim() || createInvite.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-ink text-canvas rounded-btn text-[13px] font-medium disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              New invite
            </button>
          </div>
        </div>

        {createInvite.isError && (
          <div className="px-5 py-2 text-xs text-neg">
            {createInvite.error instanceof Error ? createInvite.error.message : 'Failed to create invitation'}
          </div>
        )}

        {inviteUrl && (
          <div className="px-5 py-3 border-b border-line-2" style={{ background: 'color-mix(in oklch, var(--accent) 6%, transparent)' }}>
            <div className="flex items-center gap-2">
              <code className="mono text-xs flex-1 break-all">{inviteUrl}</code>
              <button
                onClick={() => copyLink(inviteUrl)}
                className="px-3 py-1 text-xs rounded-pill bg-ink text-canvas font-medium"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        )}

        {pendingInvites.map((inv, i) => (
          <div
            key={inv.id}
            className="flex items-center justify-between px-5 py-3"
            style={{ borderTop: i === 0 && !inviteUrl ? 'none' : '1px solid var(--line-2)' }}
          >
            <div>
              <div className="mono text-[13px]">{inv.email}</div>
              <div className="mono text-[10.5px] text-ink-3 mt-0.5" style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                {inv.role} · expires in {expiresIn(inv.expiresAt)}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => copyLink(`${window.location.origin}/invite/accept?token=${inv.id}`)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-line bg-surface rounded-btn text-[13px] font-medium text-ink cursor-pointer hover:bg-canvas-alt transition-colors"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy link
              </button>
              <button
                onClick={() => revokeInvite.mutate(inv.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-line bg-surface rounded-btn text-[13px] font-medium text-ink cursor-pointer hover:bg-canvas-alt transition-colors"
              >
                Revoke
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Members list */}
      {members.length > 0 && (
        <div className="rounded-card border border-line bg-surface">
          <div className="px-5 py-4 border-b border-line-2">
            <div className="text-[15px] font-medium">Members ({members.length})</div>
          </div>
          {members.map((m, i) => (
            <div
              key={m.id}
              className="flex items-center justify-between px-5 py-3"
              style={{ borderTop: i === 0 ? 'none' : '1px solid var(--line-2)' }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-7 h-7 rounded-full text-white grid place-items-center text-[10px] font-semibold flex-shrink-0"
                  style={{ background: `oklch(0.7 0.12 ${(i * 55) % 360})` }}
                >
                  {m.displayName.split(' ').map((n) => n[0]).join('')}
                </div>
                <div>
                  <div className="font-medium text-[13px]">{m.displayName}</div>
                  <div className="mono text-[10.5px] text-ink-3">{m.email}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {m.role !== 'primary_owner' && m.id !== currentUser?.id && (
                  <select
                    value={m.role}
                    onChange={(e) => changeRole.mutate({ id: m.id, role: e.target.value })}
                    className="mono text-[10.5px] px-2 py-1 rounded-pill border border-line bg-surface text-ink"
                    style={{ letterSpacing: '0.04em' }}
                  >
                    <option value="owner">Owner</option>
                    <option value="developer">Developer</option>
                  </select>
                )}
                <span
                  className="mono text-[10.5px] px-2 py-0.5 rounded-pill border border-line text-ink-2"
                  style={{ letterSpacing: '0.05em', textTransform: 'uppercase' }}
                >
                  {m.role === 'primary_owner' ? 'Primary' : m.role}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
