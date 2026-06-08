import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiDelete, getUser } from '@/api/client';
import { Plus, Copy, Trash2, Upload, X } from 'lucide-react';
import { useOrgList, useWorkspaceList } from '@/api/hooks';
import { useScope } from '@/lib/scope';

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
  const scope = useScope();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'developer' | 'workspace_admin' | 'owner'>('developer');
  // Invite form defaults: prefer the top-bar scope, fall back to default org/ws.
  const [inviteOrgId, setInviteOrgId] = useState<string>(scope.orgId ?? 'default');
  const [inviteWorkspaceId, setInviteWorkspaceId] = useState<string>(scope.workspaceId ?? 'default-ws');
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  // Sync the invite form to the top-bar scope when the user changes scope —
  // unless they've already started typing or manually overridden.
  useEffect(() => {
    if (scope.orgId) setInviteOrgId(scope.orgId);
  }, [scope.orgId]);
  useEffect(() => {
    if (scope.workspaceId) setInviteWorkspaceId(scope.workspaceId);
  }, [scope.workspaceId]);

  const { data: orgs = [] } = useOrgList();
  const { data: workspacesForInvite = [] } = useWorkspaceList(inviteOrgId);

  // Whenever the workspace list refreshes (org changed, first load), reset
  // the selected workspace to the first available unless it's still valid.
  useEffect(() => {
    if (workspacesForInvite.length === 0) {
      setInviteWorkspaceId('');
      return;
    }
    const currentStillValid = workspacesForInvite.some((w) => w.id === inviteWorkspaceId);
    if (!currentStillValid) {
      setInviteWorkspaceId(workspacesForInvite[0].id);
    }
  }, [workspacesForInvite, inviteWorkspaceId]);

  const { data: invitations = [] } = useQuery({
    queryKey: ['admin-invitations', scope.orgId, scope.workspaceId],
    queryFn: () => apiGet<Invitation[]>('/api/v1/admin/invitations', {
      ...(scope.orgId ? { orgId: scope.orgId } : {}),
      ...(scope.workspaceId ? { workspaceId: scope.workspaceId } : {}),
    }),
  });

  const { data: members = [] } = useQuery({
    queryKey: ['admin-members', scope.orgId, scope.workspaceId],
    queryFn: () => apiGet<Member[]>('/api/v1/admin/members', {
      ...(scope.orgId ? { orgId: scope.orgId } : {}),
      ...(scope.workspaceId ? { workspaceId: scope.workspaceId } : {}),
    }),
  });

  const createInvite = useMutation({
    mutationFn: ({ email, role, orgId, workspaceId }: { email: string; role: string; orgId: string; workspaceId: string }) =>
      apiPost<{ id: string; inviteUrl: string; email: string; expiresAt: string; role: string }>(
        '/api/v1/admin/invitations',
        { email, role, orgId, workspaceId },
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
  const activeOrg = orgs.find((o) => o.id === scope.orgId);
  const scopeLabel = scope.orgId
    ? scope.workspaceId
      ? `${activeOrg?.name ?? '…'} / workspace ${scope.workspaceId}`
      : (activeOrg?.name ?? scope.orgId)
    : 'All organizations';

  return (
    <div>
      {/* Page header */}
      <div className="mb-6">
        <div className="label mb-2">ORGANIZATION</div>
        <h1 className="text-title m-0" style={{ fontSize: 36, lineHeight: 1.05 }}>Team</h1>
        <div className="text-ink-3 mt-2 text-sm">
          Invites, roles and API keys for <span className="text-ink font-medium">{scopeLabel}</span>.
        </div>
      </div>

      {/* Pending invites card */}
      <div className="rounded-card border border-line bg-surface mb-4">
        <div className="px-5 py-4 border-b border-line-2">
          <div className="flex items-center justify-between mb-3.5">
            <div>
              <div className="text-[15px] font-medium">Pending invites</div>
              <div className="text-ink-3 text-[13px] mt-1">
                {pendingInvites.length} invite{pendingInvites.length !== 1 ? 's' : ''} outstanding.
              </div>
            </div>
          </div>
          {/* Invite form — two rows so 4 inputs fit without horizontal scroll */}
          <div className="flex flex-wrap gap-2 items-center">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => { setInviteEmail(e.target.value); setInviteUrl(null); }}
              placeholder="name@example.com"
              className="px-3 py-1.5 text-[13px] rounded-btn border border-line bg-surface text-ink placeholder:text-ink-3 focus:outline-none w-60"
              onKeyDown={(e) => { if (e.key === 'Enter' && inviteEmail.trim()) createInvite.mutate({ email: inviteEmail.trim(), role: inviteRole, orgId: inviteOrgId, workspaceId: inviteWorkspaceId }); }}
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as 'developer' | 'workspace_admin' | 'owner')}
              className="px-2 py-1.5 text-[13px] rounded-btn border border-line bg-surface text-ink"
              title="Role"
            >
              <option value="developer">Developer</option>
              <option value="workspace_admin">Workspace Admin</option>
              <option value="owner">Platform Admin</option>
            </select>
            <select
              value={inviteOrgId}
              onChange={(e) => {
                const newOrgId = e.target.value;
                setInviteOrgId(newOrgId);
                // Reset workspace when org changes — the workspace list will refetch.
                setInviteWorkspaceId('');
              }}
              className="px-2 py-1.5 text-[13px] rounded-btn border border-line bg-surface text-ink"
              title="Organization"
            >
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
            <select
              value={inviteWorkspaceId}
              onChange={(e) => setInviteWorkspaceId(e.target.value)}
              className="px-2 py-1.5 text-[13px] rounded-btn border border-line bg-surface text-ink"
              title="Workspace"
              disabled={workspacesForInvite.length === 0}
            >
              {workspacesForInvite.length === 0 && <option value="">No workspaces…</option>}
              {workspacesForInvite.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
            <button
              onClick={() => {
                if (!inviteEmail.trim() || !inviteWorkspaceId) return;
                createInvite.mutate({ email: inviteEmail.trim(), role: inviteRole, orgId: inviteOrgId, workspaceId: inviteWorkspaceId });
              }}
              disabled={!inviteEmail.trim() || !inviteWorkspaceId || createInvite.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-ink text-canvas rounded-btn text-[13px] font-medium disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              New invite
            </button>
            <button
              onClick={() => setBulkOpen(true)}
              disabled={!inviteWorkspaceId}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-line bg-surface text-ink rounded-btn text-[13px] font-medium hover:bg-canvas-alt disabled:opacity-50"
              title="Invite many people at once"
            >
              <Upload className="h-3.5 w-3.5" />
              Bulk invite…
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
                {m.role !== 'platform_owner' && m.role !== 'primary_owner' && m.id !== currentUser?.id && (
                  <select
                    value={m.role === 'owner' ? 'platform_admin' : m.role}
                    onChange={(e) => changeRole.mutate({ id: m.id, role: e.target.value })}
                    className="mono text-[10.5px] px-2 py-1 rounded-pill border border-line bg-surface text-ink"
                    style={{ letterSpacing: '0.04em' }}
                  >
                    <option value="platform_admin">Platform Admin</option>
                    <option value="workspace_admin">Workspace Admin</option>
                    <option value="developer">Developer</option>
                  </select>
                )}
                <span
                  className="mono text-[10.5px] px-2 py-0.5 rounded-pill border border-line text-ink-2"
                  style={{ letterSpacing: '0.05em', textTransform: 'uppercase' }}
                >
                  {m.role === 'platform_owner' || m.role === 'primary_owner' ? 'Owner' :
                   m.role === 'platform_admin' || m.role === 'owner' ? 'Admin' :
                   m.role === 'workspace_admin' ? 'Workspace Admin' :
                   'Developer'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {bulkOpen && (
        <BulkInviteModal
          defaultOrgId={inviteOrgId}
          defaultWorkspaceId={inviteWorkspaceId}
          defaultRole={inviteRole}
          orgs={orgs}
          onClose={() => setBulkOpen(false)}
          onDone={() => {
            void qc.invalidateQueries({ queryKey: ['admin-invitations'] });
          }}
        />
      )}
    </div>
  );
}

// ── Bulk invite modal ────────────────────────────────────────────────────

interface BulkResult {
  email: string;
  inviteUrl?: string;
  error?: string;
  expiresAt?: string;
}

function BulkInviteModal({
  defaultOrgId,
  defaultWorkspaceId,
  defaultRole,
  orgs,
  onClose,
  onDone,
}: {
  defaultOrgId: string;
  defaultWorkspaceId: string;
  defaultRole: 'developer' | 'workspace_admin' | 'owner';
  orgs: Array<{ id: string; name: string }>;
  onClose: () => void;
  onDone: () => void;
}) {
  const [text, setText] = useState('');
  const [orgId, setOrgId] = useState(defaultOrgId);
  const [workspaceId, setWorkspaceId] = useState(defaultWorkspaceId);
  const [role, setRole] = useState<'developer' | 'workspace_admin' | 'owner'>(defaultRole);
  const { data: workspaces = [] } = useWorkspaceList(orgId);
  const [results, setResults] = useState<BulkResult[] | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  useEffect(() => {
    if (workspaces.length === 0) { setWorkspaceId(''); return; }
    if (!workspaces.some((w) => w.id === workspaceId)) setWorkspaceId(workspaces[0].id);
  }, [workspaces, workspaceId]);

  const emails = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of text.split(/[\n,;]+/)) {
      const e = raw.trim().toLowerCase();
      if (!e || seen.has(e)) continue;
      seen.add(e);
      out.push(e);
    }
    return out;
  }, [text]);

  const submit = useMutation({
    mutationFn: () =>
      apiPost<{ results: BulkResult[] }>('/api/v1/admin/invitations/bulk', {
        invites: emails.map((email: string) => ({ email, orgId, workspaceId, role })),
      }),
    onSuccess: (data) => { setResults(data.results); onDone(); },
  });

  const successCount = results?.filter((r) => r.inviteUrl).length ?? 0;
  const errorCount = results?.filter((r) => r.error).length ?? 0;

  function copyAllLinks() {
    if (!results) return;
    const lines = results
      .filter((r) => r.inviteUrl)
      .map((r) => `${r.email}\t${r.inviteUrl}`)
      .join('\n');
    navigator.clipboard.writeText(lines).then(() => {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    });
  }

  function copyOne(url: string) {
    navigator.clipboard.writeText(url);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-surface border border-line rounded-card shadow-popover w-full max-w-2xl mx-4 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-line-2 flex items-start justify-between sticky top-0 bg-surface">
          <div>
            <div className="text-[15px] font-medium">Bulk invite</div>
            <div className="text-ink-3 text-xs mt-0.5">
              Paste a list of emails (one per line or comma-separated). All go to the same org + workspace + role.
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-ink-3 hover:text-ink"><X className="h-4 w-4" /></button>
        </div>

        <div className="p-5 space-y-4">
          {!results && (
            <>
              <div>
                <label className="label block mb-1.5">Emails</label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={8}
                  placeholder={'alice@example.com\nbob@example.com\ncharlie@example.com'}
                  className="w-full px-3 py-2 text-[13px] mono rounded-btn border border-line bg-surface text-ink placeholder:text-ink-3 focus:outline-none resize-y"
                />
                <div className="text-ink-3 text-xs mt-1.5">{emails.length} unique email{emails.length === 1 ? '' : 's'} parsed.</div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label block mb-1.5">Organization</label>
                  <select
                    value={orgId}
                    onChange={(e) => { setOrgId(e.target.value); setWorkspaceId(''); }}
                    className="w-full px-2 py-1.5 text-[13px] rounded-btn border border-line bg-surface text-ink"
                  >
                    {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label block mb-1.5">Workspace</label>
                  <select
                    value={workspaceId}
                    onChange={(e) => setWorkspaceId(e.target.value)}
                    disabled={workspaces.length === 0}
                    className="w-full px-2 py-1.5 text-[13px] rounded-btn border border-line bg-surface text-ink disabled:opacity-50"
                  >
                    {workspaces.length === 0 && <option value="">No workspaces…</option>}
                    {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label block mb-1.5">Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as 'developer' | 'workspace_admin' | 'owner')}
                    className="w-full px-2 py-1.5 text-[13px] rounded-btn border border-line bg-surface text-ink"
                  >
                    <option value="developer">Developer</option>
                    <option value="workspace_admin">Workspace Admin</option>
                    <option value="owner">Platform Admin</option>
                  </select>
                </div>
              </div>
              {submit.isError && (
                <div className="text-xs text-neg">
                  {submit.error instanceof Error ? submit.error.message : 'Bulk invite failed.'}
                </div>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={onClose} className="px-3 py-1.5 text-[13px] text-ink-3 hover:text-ink">Cancel</button>
                <button
                  onClick={() => submit.mutate()}
                  disabled={emails.length === 0 || !workspaceId || submit.isPending}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-ink text-canvas rounded-btn text-[13px] font-medium disabled:opacity-50"
                >
                  {submit.isPending ? 'Creating…' : `Create ${emails.length} invite${emails.length === 1 ? '' : 's'}`}
                </button>
              </div>
            </>
          )}

          {results && (
            <>
              <div className="flex items-center justify-between">
                <div className="text-[13px]">
                  <span className="font-medium">{successCount}</span>
                  <span className="text-ink-3"> created</span>
                  {errorCount > 0 && (
                    <>
                      <span className="text-ink-4"> · </span>
                      <span className="font-medium text-neg">{errorCount}</span>
                      <span className="text-ink-3"> failed</span>
                    </>
                  )}
                </div>
                {successCount > 0 && (
                  <button
                    onClick={copyAllLinks}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] border border-line rounded-btn text-ink hover:bg-canvas-alt"
                  >
                    <Copy className="h-3 w-3" /> {copiedAll ? 'Copied!' : 'Copy all'}
                  </button>
                )}
              </div>
              <div className="rounded-btn border border-line max-h-[40vh] overflow-y-auto">
                <table className="w-full text-[13px]">
                  <tbody>
                    {results.map((r, i) => (
                      <tr key={i} style={{ borderBottom: i === results.length - 1 ? 'none' : '1px solid var(--line-2)' }}>
                        <td className="px-3 py-2 mono text-[12px]">{r.email}</td>
                        <td className="px-3 py-2 text-right">
                          {r.inviteUrl ? (
                            <button
                              onClick={() => copyOne(r.inviteUrl!)}
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] border border-line rounded-pill text-ink hover:bg-canvas-alt"
                            >
                              <Copy className="h-3 w-3" /> Copy link
                            </button>
                          ) : (
                            <span className="text-xs text-neg">{r.error}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => { setResults(null); setText(''); }}
                  className="px-3 py-1.5 text-[13px] text-ink-3 hover:text-ink"
                >
                  Invite more
                </button>
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 bg-ink text-canvas rounded-btn text-[13px] font-medium"
                >
                  Done
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
