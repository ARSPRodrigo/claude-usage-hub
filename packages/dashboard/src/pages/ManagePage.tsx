import { useEffect, useMemo, useState } from 'react';
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, ArrowRight, Search, Shield, X } from 'lucide-react';
import { apiGet, apiPost, apiDelete, getUser, isPlatformOwner, isPlatformAdmin } from '@/api/client';
import {
  useAdminOrgList,
  useAdminWorkspaceList,
  useAdminMembers,
  useWorkspaceList,
  type OrgRow,
  type WorkspaceRow,
  type MemberRow,
} from '@/api/hooks';
import { formatRelative } from '@/lib/utils';
import { useScope } from '@/lib/scope';

export type ManageSection = 'orgs' | 'workspaces' | 'members' | 'audit' | 'domain-rules';

const SECTION_META: Record<ManageSection, { title: string; subtitle: string }> = {
  orgs:           { title: 'Organizations', subtitle: 'Create, rename, and remove organizations.' },
  workspaces:     { title: 'Workspaces',    subtitle: 'Workspaces live inside organizations.' },
  members:        { title: 'Members',       subtitle: 'Search every member and move them between orgs and workspaces.' },
  audit:          { title: 'Audit log',     subtitle: 'Recent role and membership changes.' },
  'domain-rules': { title: 'Domain rules',  subtitle: 'Auto-assign new sign-ups to an org and workspace by email domain.' },
};

async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const token = localStorage.getItem('chub_token');
  const res = await fetch(new URL(path, window.location.origin).toString(), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Server error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function ManagePage({ section }: { section: ManageSection }) {
  const meta = SECTION_META[section];
  return (
    <div>
      {/* Page header */}
      <div className="mb-6">
        <div className="label mb-2">MANAGE</div>
        <h1 className="text-title m-0" style={{ fontSize: 36, lineHeight: 1.05 }}>{meta.title}</h1>
        <div className="text-ink-3 mt-2 text-sm">{meta.subtitle}</div>
      </div>

      {section === 'orgs' && <OrgsTab />}
      {section === 'workspaces' && <WorkspacesTab />}
      {section === 'members' && <MembersTab />}
      {section === 'audit' && <AuditTab />}
      {section === 'domain-rules' && <DomainRulesTab />}
    </div>
  );
}

// ── Organizations tab ──────────────────────────────────────────────────────

function OrgsTab() {
  const qc = useQueryClient();
  const currentUser = getUser();
  const canCreateOrDelete = isPlatformAdmin(currentUser?.role);
  const { data: orgs = [], isLoading } = useAdminOrgList();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: (name: string) => apiPost<OrgRow>('/api/v1/admin/organizations', { name }),
    onSuccess: () => { setNewName(''); setError(null); void qc.invalidateQueries({ queryKey: ['admin-orgs'] }); void qc.invalidateQueries({ queryKey: ['orgs'] }); },
    onError: (e) => setError(e instanceof Error ? e.message : 'Failed to create'),
  });
  const rename = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => apiPatch<OrgRow>(`/api/v1/admin/organizations/${id}`, { name }),
    onSuccess: () => { setEditingId(null); setError(null); void qc.invalidateQueries({ queryKey: ['admin-orgs'] }); void qc.invalidateQueries({ queryKey: ['orgs'] }); },
    onError: (e) => setError(e instanceof Error ? e.message : 'Failed to rename'),
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiDelete<{ ok: boolean }>(`/api/v1/admin/organizations/${id}`),
    onSuccess: () => { setError(null); void qc.invalidateQueries({ queryKey: ['admin-orgs'] }); void qc.invalidateQueries({ queryKey: ['orgs'] }); },
    onError: (e) => setError(e instanceof Error ? e.message : 'Failed to delete'),
  });

  return (
    <div>
      {/* Create card — platform admin only */}
      {canCreateOrDelete && (
        <div className="rounded-card border border-line bg-surface mb-4 p-4">
          <div className="text-[15px] font-medium mb-2.5">Create organization</div>
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => { setNewName(e.target.value); setError(null); }}
              placeholder="e.g. ACME Engineering"
              className="flex-1 px-3 py-1.5 text-[13px] rounded-btn border border-line bg-surface text-ink placeholder:text-ink-3 focus:outline-none"
              onKeyDown={(e) => { if (e.key === 'Enter' && newName.trim()) create.mutate(newName.trim()); }}
            />
            <button
              onClick={() => { if (newName.trim()) create.mutate(newName.trim()); }}
              disabled={!newName.trim() || create.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-ink text-canvas rounded-btn text-[13px] font-medium disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" /> Create
            </button>
          </div>
          {error && <div className="mt-2 text-xs text-neg">{error}</div>}
        </div>
      )}

      {/* List */}
      <div className="rounded-card border border-line bg-surface overflow-hidden">
        <div className="px-5 py-4 border-b border-line-2">
          <div className="text-[15px] font-medium">{canCreateOrDelete ? 'All organizations' : 'Organizations you own'}</div>
          <div className="text-ink-3 text-[13px] mt-1">{orgs.length} total</div>
        </div>
        {isLoading ? (
          <div className="p-5 text-sm text-ink-3">Loading…</div>
        ) : orgs.length === 0 ? (
          <div className="p-5 text-sm text-ink-3">No organizations yet.</div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line">
                {['Name', 'Slug', 'Created', ''].map((h) => (
                  <th key={h} className="label py-2.5 px-4 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orgs.map((o, i) => (
                <tr key={o.id} style={{ borderBottom: i === orgs.length - 1 ? 'none' : '1px solid var(--line-2)' }}>
                  <td className="px-4 py-3 font-medium">
                    {editingId === o.id ? (
                      <input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && editingName.trim()) rename.mutate({ id: o.id, name: editingName.trim() });
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        onBlur={() => setEditingId(null)}
                        className="px-2 py-1 text-[13px] rounded-btn border border-line bg-surface text-ink focus:outline-none"
                      />
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        {o.name}
                        {o.id === 'default' && <span className="mono text-[10px] text-ink-3" style={{ letterSpacing: '0.06em' }}>DEFAULT</span>}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 mono text-ink-3 text-xs">{o.slug}</td>
                  <td className="px-4 py-3 text-ink-3 text-xs">{formatRelative(o.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1.5">
                      <button
                        onClick={() => { setEditingId(o.id); setEditingName(o.name); }}
                        className="p-1.5 text-ink-3 hover:text-ink transition-colors"
                        title="Rename"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {canCreateOrDelete && (
                        <button
                          onClick={() => {
                            if (o.id === 'default') return;
                            if (confirm(`Delete organization "${o.name}"? This cannot be undone.`)) {
                              remove.mutate(o.id);
                            }
                          }}
                          disabled={o.id === 'default'}
                          className="p-1.5 text-ink-3 hover:text-neg transition-colors disabled:opacity-30 disabled:hover:text-ink-3"
                          title={o.id === 'default' ? 'Cannot delete the default organization' : 'Delete'}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Workspaces tab ─────────────────────────────────────────────────────────

function WorkspacesTab() {
  const qc = useQueryClient();
  const { data: orgs = [] } = useAdminOrgList();
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);

  // Default to first org if not selected
  const orgId = activeOrgId ?? orgs[0]?.id ?? null;

  const { data: workspaces = [], isLoading } = useAdminWorkspaceList(orgId);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: ({ orgId, name }: { orgId: string; name: string }) =>
      apiPost<WorkspaceRow>(`/api/v1/admin/organizations/${orgId}/workspaces`, { name }),
    onSuccess: () => { setNewName(''); setError(null); void qc.invalidateQueries({ queryKey: ['admin-workspaces'] }); void qc.invalidateQueries({ queryKey: ['workspaces'] }); },
    onError: (e) => setError(e instanceof Error ? e.message : 'Failed to create'),
  });
  const rename = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => apiPatch<WorkspaceRow>(`/api/v1/admin/workspaces/${id}`, { name }),
    onSuccess: () => { setEditingId(null); setError(null); void qc.invalidateQueries({ queryKey: ['admin-workspaces'] }); void qc.invalidateQueries({ queryKey: ['workspaces'] }); },
    onError: (e) => setError(e instanceof Error ? e.message : 'Failed to rename'),
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiDelete<{ ok: boolean }>(`/api/v1/admin/workspaces/${id}`),
    onSuccess: () => { setError(null); void qc.invalidateQueries({ queryKey: ['admin-workspaces'] }); void qc.invalidateQueries({ queryKey: ['workspaces'] }); },
    onError: (e) => setError(e instanceof Error ? e.message : 'Failed to delete'),
  });

  return (
    <div>
      {/* Org picker */}
      <div className="flex items-center gap-2 mb-4 text-[13px]">
        <span className="text-ink-3">Organization:</span>
        <select
          value={orgId ?? ''}
          onChange={(e) => setActiveOrgId(e.target.value)}
          className="px-2 py-1 text-[13px] rounded-btn border border-line bg-surface text-ink"
        >
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      </div>

      {/* Create card */}
      <div className="rounded-card border border-line bg-surface mb-4 p-4">
        <div className="text-[15px] font-medium mb-2.5">Create workspace</div>
        <div className="flex gap-2">
          <input
            value={newName}
            onChange={(e) => { setNewName(e.target.value); setError(null); }}
            placeholder="e.g. Frontend Team"
            className="flex-1 px-3 py-1.5 text-[13px] rounded-btn border border-line bg-surface text-ink placeholder:text-ink-3 focus:outline-none"
            onKeyDown={(e) => { if (e.key === 'Enter' && newName.trim() && orgId) create.mutate({ orgId, name: newName.trim() }); }}
          />
          <button
            onClick={() => { if (newName.trim() && orgId) create.mutate({ orgId, name: newName.trim() }); }}
            disabled={!newName.trim() || create.isPending || !orgId}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-ink text-canvas rounded-btn text-[13px] font-medium disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" /> Create
          </button>
        </div>
        {error && <div className="mt-2 text-xs text-neg">{error}</div>}
      </div>

      {/* List */}
      <div className="rounded-card border border-line bg-surface overflow-hidden">
        <div className="px-5 py-4 border-b border-line-2">
          <div className="text-[15px] font-medium">Workspaces in {orgs.find((o) => o.id === orgId)?.name ?? '…'}</div>
          <div className="text-ink-3 text-[13px] mt-1">{workspaces.length} total</div>
        </div>
        {isLoading ? (
          <div className="p-5 text-sm text-ink-3">Loading…</div>
        ) : workspaces.length === 0 ? (
          <div className="p-5 text-sm text-ink-3">No workspaces in this organization yet.</div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line">
                {['Name', 'Slug', 'Created', ''].map((h) => (
                  <th key={h} className="label py-2.5 px-4 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {workspaces.map((w, i) => (
                <tr key={w.id} style={{ borderBottom: i === workspaces.length - 1 ? 'none' : '1px solid var(--line-2)' }}>
                  <td className="px-4 py-3 font-medium">
                    {editingId === w.id ? (
                      <input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && editingName.trim()) rename.mutate({ id: w.id, name: editingName.trim() });
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        onBlur={() => setEditingId(null)}
                        className="px-2 py-1 text-[13px] rounded-btn border border-line bg-surface text-ink focus:outline-none"
                      />
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        {w.name}
                        {w.id === 'default-ws' && <span className="mono text-[10px] text-ink-3" style={{ letterSpacing: '0.06em' }}>DEFAULT</span>}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 mono text-ink-3 text-xs">{w.slug}</td>
                  <td className="px-4 py-3 text-ink-3 text-xs">{formatRelative(w.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1.5">
                      <button
                        onClick={() => { setEditingId(w.id); setEditingName(w.name); }}
                        className="p-1.5 text-ink-3 hover:text-ink transition-colors"
                        title="Rename"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (w.id === 'default-ws') return;
                          if (confirm(`Delete workspace "${w.name}"? This cannot be undone.`)) {
                            remove.mutate(w.id);
                          }
                        }}
                        disabled={w.id === 'default-ws'}
                        className="p-1.5 text-ink-3 hover:text-neg transition-colors disabled:opacity-30 disabled:hover:text-ink-3"
                        title={w.id === 'default-ws' ? 'Cannot delete the default workspace' : 'Delete'}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Audit log tab (stub UI — full version in 3c) ───────────────────────────

interface AuditEntry {
  id: string;
  actorId: string;
  targetId: string;
  action: string;
  scopeId: string | null;
  scopeType: 'org' | 'workspace' | null;
  timestamp: string;
  /** Resolved server-side. */
  actorName?: string;
  actorEmail?: string;
  targetName?: string;
  targetEmail?: string;
  scopeName?: string | null;
}

const ACTION_LABELS: Record<string, string> = {
  create_organization: 'created an organization',
  rename_organization: 'renamed an organization',
  delete_organization: 'deleted an organization',
  create_workspace: 'created a workspace',
  rename_workspace: 'renamed a workspace',
  delete_workspace: 'deleted a workspace',
  move_user: 'moved a member',
  add_org_owner: 'granted org ownership to',
  remove_org_owner: 'revoked org ownership from',
  add_workspace_owner: 'granted workspace ownership to',
  remove_workspace_owner: 'revoked workspace ownership from',
  promote_platform_admin: 'promoted to Platform Admin',
  demote_platform_admin: 'demoted to Developer',
  transfer_platform_owner: 'transferred platform ownership to',
};

// ── Members tab ───────────────────────────────────────────────────────────

function MembersTab() {
  const qc = useQueryClient();
  const scope = useScope();
  const currentUser = getUser();
  const showTransferButton = isPlatformOwner(currentUser?.role);
  const { data: members = [], isLoading } = useAdminMembers();
  const { data: orgs = [] } = useAdminOrgList();

  const [query, setQuery] = useState('');
  // Default the org filter to the top-bar scope, but allow override.
  // Re-sync if the top-bar scope changes.
  const [orgFilter, setOrgFilter] = useState<'all' | string>(scope.orgId ?? 'all');
  useEffect(() => {
    setOrgFilter(scope.orgId ?? 'all');
  }, [scope.orgId]);
  const [movingMember, setMovingMember] = useState<MemberRow | null>(null);
  const [grantingMember, setGrantingMember] = useState<MemberRow | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter((m) => {
      if (orgFilter === 'unassigned') {
        if (m.currentOrgId !== null) return false;
      } else if (orgFilter !== 'all') {
        if ((m.currentOrgId ?? '') !== orgFilter) return false;
      }
      if (!q) return true;
      return (
        m.email.toLowerCase().includes(q) ||
        m.displayName.toLowerCase().includes(q)
      );
    });
  }, [members, query, orgFilter]);

  const unassignedCount = useMemo(() => members.filter((m) => m.currentOrgId === null).length, [members]);

  const orgById = useMemo(() => new Map(orgs.map((o) => [o.id, o])), [orgs]);

  // Keep grantingMember in sync with refreshed list so the modal reflects
  // edits immediately after a mutation invalidates the query.
  useEffect(() => {
    if (!grantingMember) return;
    const fresh = members.find((m) => m.id === grantingMember.id);
    if (fresh && fresh !== grantingMember) setGrantingMember(fresh);
  }, [members, grantingMember]);

  const invalidateAll = () => {
    void qc.invalidateQueries({ queryKey: ['admin-members-with-scope'] });
    void qc.invalidateQueries({ queryKey: ['admin-dev-stats'] });
    void qc.invalidateQueries({ queryKey: ['admin-audit'] });
  };

  return (
    <div>
      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 border border-line bg-surface rounded-btn">
          <Search className="h-3.5 w-3.5 text-ink-3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email…"
            className="bg-transparent text-[13px] text-ink placeholder:text-ink-3 focus:outline-none w-64"
          />
        </div>
        <select
          value={orgFilter}
          onChange={(e) => setOrgFilter(e.target.value)}
          className="px-2 py-1.5 text-[13px] rounded-btn border border-line bg-surface text-ink"
        >
          <option value="all">All organizations</option>
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
          {unassignedCount > 0 && (
            <option value="unassigned">Unassigned ({unassignedCount})</option>
          )}
        </select>
        <span className="text-ink-3 text-xs ml-auto">{filtered.length} of {members.length} member{members.length === 1 ? '' : 's'}</span>
        {showTransferButton && (
          <button
            onClick={() => setTransferOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] border border-line rounded-btn text-ink hover:bg-canvas-alt"
            title="Transfer the platform owner role to another user"
          >
            <Shield className="h-3.5 w-3.5" /> Transfer ownership…
          </button>
        )}
      </div>

      <div className="rounded-card border border-line bg-surface overflow-hidden">
        {isLoading ? (
          <div className="p-5 text-sm text-ink-3">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-5 text-sm text-ink-3">No members match.</div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line">
                {['Name', 'Email', 'Role', 'Organization', 'Workspace', 'Owns', ''].map((h) => (
                  <th key={h} className="label py-2.5 px-4 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((m, i) => (
                <tr key={m.id} style={{ borderBottom: i === filtered.length - 1 ? 'none' : '1px solid var(--line-2)' }}>
                  <td className="px-4 py-3 font-medium">{m.displayName}</td>
                  <td className="px-4 py-3 mono text-ink-3 text-xs">{m.email}</td>
                  <td className="px-4 py-3 text-ink-2 text-xs">{labelForRole(m.role)}</td>
                  <td className="px-4 py-3 text-ink-2">
                    {m.currentOrgId ? (orgById.get(m.currentOrgId)?.name ?? m.currentOrgId) : <span className="text-ink-4">—</span>}
                  </td>
                  <td className="px-4 py-3 text-ink-2 mono text-xs">
                    {m.currentWorkspaceId ?? <span className="text-ink-4">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <OwnedSummary
                      orgCount={m.ownedOrgIds.length}
                      wsCount={m.ownedWorkspaceIds.length}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1.5">
                      <button
                        onClick={() => setGrantingMember(m)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] border border-line rounded-btn text-ink hover:bg-canvas-alt"
                        title="Manage role and ownership grants"
                      >
                        <Shield className="h-3 w-3" /> Grants
                      </button>
                      <button
                        onClick={() => setMovingMember(m)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] border border-line rounded-btn text-ink hover:bg-canvas-alt"
                      >
                        Move <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {movingMember && (
        <MoveMemberModal
          member={movingMember}
          onClose={() => setMovingMember(null)}
          onMoved={() => {
            setMovingMember(null);
            invalidateAll();
          }}
        />
      )}

      {grantingMember && (
        <GrantsModal
          member={grantingMember}
          onClose={() => setGrantingMember(null)}
          onChange={invalidateAll}
        />
      )}

      {transferOpen && (
        <TransferOwnerModal
          onClose={() => setTransferOpen(false)}
          onTransferred={() => {
            setTransferOpen(false);
            invalidateAll();
            // The current user just became platform_admin — refresh /auth/me
            // so the UI updates immediately.
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}

function OwnedSummary({ orgCount, wsCount }: { orgCount: number; wsCount: number }) {
  if (orgCount === 0 && wsCount === 0) {
    return <span className="text-ink-4 text-xs">—</span>;
  }
  return (
    <div className="inline-flex items-center gap-1.5">
      {orgCount > 0 && (
        <span
          className="mono text-[10.5px] px-2 py-0.5 rounded-pill border border-line text-ink-2"
          style={{ letterSpacing: '0.05em', textTransform: 'uppercase' }}
        >
          {orgCount} org{orgCount === 1 ? '' : 's'}
        </span>
      )}
      {wsCount > 0 && (
        <span
          className="mono text-[10.5px] px-2 py-0.5 rounded-pill border border-line text-ink-2"
          style={{ letterSpacing: '0.05em', textTransform: 'uppercase' }}
        >
          {wsCount} ws
        </span>
      )}
    </div>
  );
}

function labelForRole(role: string): string {
  if (role === 'platform_owner' || role === 'primary_owner') return 'Owner';
  if (role === 'platform_admin' || role === 'owner') return 'Admin';
  if (role === 'workspace_admin') return 'Workspace Admin';
  return 'Developer';
}

// ── Move member modal ─────────────────────────────────────────────────────

function MoveMemberModal({
  member,
  onClose,
  onMoved,
}: {
  member: MemberRow;
  onClose: () => void;
  onMoved: () => void;
}) {
  const { data: orgs = [] } = useAdminOrgList();
  const [orgId, setOrgId] = useState<string>(member.currentOrgId ?? orgs[0]?.id ?? '');
  const [workspaceId, setWorkspaceId] = useState<string>('');
  const { data: workspaces = [] } = useWorkspaceList(orgId);

  // Auto-pick first workspace when list arrives or org changes.
  useEffect(() => {
    if (workspaces.length === 0) {
      setWorkspaceId('');
      return;
    }
    if (!workspaces.some((w) => w.id === workspaceId)) {
      setWorkspaceId(workspaces[0].id);
    }
  }, [workspaces, workspaceId]);

  // Default org once orgs load
  useEffect(() => {
    if (!orgId && orgs.length > 0) setOrgId(orgs[0].id);
  }, [orgs, orgId]);

  const move = useMutation({
    mutationFn: () => apiPost<{ ok: boolean }>(`/api/v1/admin/users/${member.id}/move`, { orgId, workspaceId }),
    onSuccess: onMoved,
  });

  const isNoop =
    orgId === member.currentOrgId &&
    workspaceId === member.currentWorkspaceId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-surface border border-line rounded-card shadow-popover w-full max-w-md mx-4 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[15px] font-medium mb-1">Move {member.displayName}</div>
        <div className="text-ink-3 text-xs mono mb-4">{member.email}</div>

        <div className="space-y-3 mb-4">
          <div>
            <label className="label block mb-1.5">Destination organization</label>
            <select
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              className="w-full px-2 py-1.5 text-[13px] rounded-btn border border-line bg-surface text-ink"
            >
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label block mb-1.5">Destination workspace</label>
            <select
              value={workspaceId}
              onChange={(e) => setWorkspaceId(e.target.value)}
              className="w-full px-2 py-1.5 text-[13px] rounded-btn border border-line bg-surface text-ink"
              disabled={workspaces.length === 0}
            >
              {workspaces.length === 0 && <option value="">No workspaces in this org</option>}
              {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
        </div>

        <div className="text-[12px] text-ink-3 leading-relaxed mb-5 p-3 rounded-btn bg-canvas-alt border border-line-2">
          Past usage stays attributed to where it was generated. From the moment
          you confirm, new tokens are attributed to the new workspace. This can
          be reversed by moving the member again.
        </div>

        {move.isError && (
          <div className="text-xs text-neg mb-3">
            {move.error instanceof Error ? move.error.message : 'Failed to move member.'}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-[13px] text-ink-3 hover:text-ink"
          >
            Cancel
          </button>
          <button
            onClick={() => move.mutate()}
            disabled={!orgId || !workspaceId || isNoop || move.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-ink text-canvas rounded-btn text-[13px] font-medium disabled:opacity-50"
          >
            {move.isPending ? 'Moving…' : isNoop ? 'No change' : 'Move'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Transfer Platform Owner ──────────────────────────────────────────────

function TransferOwnerModal({
  onClose,
  onTransferred,
}: {
  onClose: () => void;
  onTransferred: () => void;
}) {
  const [targetEmail, setTargetEmail] = useState('');
  const [confirm, setConfirm] = useState('');

  const transfer = useMutation({
    mutationFn: () =>
      apiPost<{ ok: boolean }>('/api/v1/admin/transfer-platform-owner', {
        targetEmail: targetEmail.trim(),
        confirm: confirm.trim(),
      }),
    onSuccess: onTransferred,
  });

  const matched = targetEmail.trim() !== '' && targetEmail.trim().toLowerCase() === confirm.trim().toLowerCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-surface border border-line rounded-card shadow-popover w-full max-w-md mx-4 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[15px] font-medium mb-1">Transfer platform ownership</div>
        <div className="text-ink-3 text-xs mb-4 leading-relaxed">
          The new owner gets full platform access. You will be downgraded to
          Platform Admin (so you keep most access, but cannot transfer
          ownership again or promote/demote admins). This action is logged
          in the audit trail.
        </div>

        <div className="space-y-3 mb-4">
          <div>
            <label className="label block mb-1.5">New owner's email</label>
            <input
              value={targetEmail}
              onChange={(e) => setTargetEmail(e.target.value)}
              placeholder="user@example.com"
              autoComplete="off"
              className="w-full px-2 py-1.5 text-[13px] rounded-btn border border-line bg-surface text-ink placeholder:text-ink-3 focus:outline-none"
            />
          </div>
          <div>
            <label className="label block mb-1.5">Confirm by retyping the email</label>
            <input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="user@example.com"
              autoComplete="off"
              className="w-full px-2 py-1.5 text-[13px] rounded-btn border border-line bg-surface text-ink placeholder:text-ink-3 focus:outline-none"
            />
            {targetEmail.trim() !== '' && confirm.trim() !== '' && !matched && (
              <div className="text-xs text-neg mt-1.5">Emails don't match.</div>
            )}
          </div>
        </div>

        {transfer.isError && (
          <div className="text-xs text-neg mb-3">
            {transfer.error instanceof Error ? transfer.error.message : 'Transfer failed.'}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-[13px] text-ink-3 hover:text-ink"
          >
            Cancel
          </button>
          <button
            onClick={() => transfer.mutate()}
            disabled={!matched || transfer.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-ink text-canvas rounded-btn text-[13px] font-medium disabled:opacity-50"
          >
            {transfer.isPending ? 'Transferring…' : 'Transfer ownership'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Grants modal: platform role + org/workspace ownership ────────────────

function GrantsModal({
  member,
  onClose,
  onChange,
}: {
  member: MemberRow;
  onClose: () => void;
  onChange: () => void;
}) {
  const { data: orgs = [] } = useAdminOrgList();
  const currentUser = getUser();
  const ownerCanChangeRole = isPlatformOwner(currentUser?.role);
  const isSelf = currentUser?.id === member.id;
  const isPlatformOwnerTarget = member.role === 'platform_owner' || member.role === 'primary_owner';
  const isPlatformAdminTarget = member.role === 'platform_admin' || member.role === 'owner';

  const orgById = useMemo(() => new Map(orgs.map((o) => [o.id, o])), [orgs]);

  const [addOrgId, setAddOrgId] = useState('');
  const [addWsOrgId, setAddWsOrgId] = useState('');
  const [addWsId, setAddWsId] = useState('');
  const { data: workspacesForAdd = [] } = useWorkspaceList(addWsOrgId || null);

  // Reset workspace pick when the org for adding workspace ownership changes.
  useEffect(() => {
    setAddWsId('');
  }, [addWsOrgId]);

  // Available orgs to grant: ones the member doesn't already own.
  const grantableOrgs = useMemo(
    () => orgs.filter((o) => !member.ownedOrgIds.includes(o.id)),
    [orgs, member.ownedOrgIds],
  );

  const promote = useMutation({
    mutationFn: () => apiPost<{ ok: boolean }>(`/api/v1/admin/users/${member.id}/promote-platform-admin`, {}),
    onSuccess: onChange,
  });
  const demote = useMutation({
    mutationFn: () => apiPost<{ ok: boolean }>(`/api/v1/admin/users/${member.id}/demote-platform-admin`, {}),
    onSuccess: onChange,
  });
  const addOrg = useMutation({
    mutationFn: (orgId: string) => apiPost<{ ok: boolean }>('/api/v1/admin/org-owners', { userId: member.id, orgId }),
    onSuccess: () => { setAddOrgId(''); onChange(); },
  });
  const removeOrg = useMutation({
    mutationFn: (orgId: string) => apiDelete<{ ok: boolean }>(`/api/v1/admin/org-owners/${member.id}/${orgId}`),
    onSuccess: onChange,
  });
  const addWs = useMutation({
    mutationFn: (workspaceId: string) => apiPost<{ ok: boolean }>('/api/v1/admin/workspace-owners', { userId: member.id, workspaceId }),
    onSuccess: () => { setAddWsId(''); setAddWsOrgId(''); onChange(); },
  });
  const removeWs = useMutation({
    mutationFn: (workspaceId: string) => apiDelete<{ ok: boolean }>(`/api/v1/admin/workspace-owners/${member.id}/${workspaceId}`),
    onSuccess: onChange,
  });

  const anyError =
    promote.error || demote.error || addOrg.error || removeOrg.error || addWs.error || removeWs.error;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-surface border border-line rounded-card shadow-popover w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-line-2 flex items-start justify-between sticky top-0 bg-surface">
          <div>
            <div className="text-[15px] font-medium">Grants for {member.displayName}</div>
            <div className="text-ink-3 text-xs mono mt-0.5">{member.email}</div>
          </div>
          <button onClick={onClose} className="p-1 text-ink-3 hover:text-ink"><X className="h-4 w-4" /></button>
        </div>

        <div className="p-5 space-y-6">
          {/* Platform role */}
          <section>
            <div className="label mb-2">Platform role</div>
            <div className="flex items-center justify-between gap-3 p-3 rounded-btn border border-line">
              <div>
                <div className="text-[13px] font-medium">{labelForRole(member.role)}</div>
                <div className="text-ink-3 text-xs mt-0.5">
                  {isPlatformOwnerTarget
                    ? 'The platform owner role can only be transferred, not removed.'
                    : isPlatformAdminTarget
                      ? 'Can manage orgs, workspaces, and members across the platform.'
                      : 'Standard user. Sees only their own usage by default.'}
                </div>
              </div>
              {!isPlatformOwnerTarget && !isSelf && ownerCanChangeRole && (
                <button
                  onClick={() => (isPlatformAdminTarget ? demote.mutate() : promote.mutate())}
                  disabled={promote.isPending || demote.isPending}
                  className="px-3 py-1.5 text-[12px] border border-line rounded-btn text-ink hover:bg-canvas-alt disabled:opacity-50"
                >
                  {isPlatformAdminTarget ? 'Demote to Developer' : 'Promote to Admin'}
                </button>
              )}
            </div>
            {!ownerCanChangeRole && !isPlatformOwnerTarget && (
              <div className="text-ink-3 text-xs mt-2">Only the platform owner can change platform-staff roles.</div>
            )}
            {isSelf && (
              <div className="text-ink-3 text-xs mt-2">You cannot change your own platform role.</div>
            )}
          </section>

          {/* Org ownership */}
          <section>
            <div className="label mb-2">Organization ownership</div>
            <div className="text-ink-3 text-xs mb-2">
              Org owners can manage workspaces, members, and settings inside that org.
            </div>
            {member.ownedOrgIds.length === 0 ? (
              <div className="text-ink-3 text-xs p-3 rounded-btn border border-line-2 bg-canvas-alt">
                Not an owner of any organization.
              </div>
            ) : (
              <div className="space-y-1.5">
                {member.ownedOrgIds.map((id) => (
                  <div key={id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-btn border border-line">
                    <div className="text-[13px]">{orgById.get(id)?.name ?? id}</div>
                    <button
                      onClick={() => removeOrg.mutate(id)}
                      disabled={removeOrg.isPending}
                      className="p-1 text-ink-3 hover:text-neg disabled:opacity-50"
                      title="Revoke ownership"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {grantableOrgs.length > 0 && (
              <div className="flex gap-2 mt-2">
                <select
                  value={addOrgId}
                  onChange={(e) => setAddOrgId(e.target.value)}
                  className="flex-1 px-2 py-1.5 text-[13px] rounded-btn border border-line bg-surface text-ink"
                >
                  <option value="">Grant ownership of…</option>
                  {grantableOrgs.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => { if (addOrgId) addOrg.mutate(addOrgId); }}
                  disabled={!addOrgId || addOrg.isPending}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-ink text-canvas rounded-btn text-[13px] font-medium disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" /> Grant
                </button>
              </div>
            )}
          </section>

          {/* Workspace ownership */}
          <section>
            <div className="label mb-2">Workspace ownership</div>
            <div className="text-ink-3 text-xs mb-2">
              Workspace owners can manage members and settings inside that workspace.
            </div>
            {member.ownedWorkspaceIds.length === 0 ? (
              <div className="text-ink-3 text-xs p-3 rounded-btn border border-line-2 bg-canvas-alt">
                Not an owner of any workspace.
              </div>
            ) : (
              <div className="space-y-1.5">
                {member.ownedWorkspaceIds.map((id) => (
                  <div key={id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-btn border border-line">
                    <div className="text-[13px] mono">{id}</div>
                    <button
                      onClick={() => removeWs.mutate(id)}
                      disabled={removeWs.isPending}
                      className="p-1 text-ink-3 hover:text-neg disabled:opacity-50"
                      title="Revoke ownership"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2 mt-2">
              <select
                value={addWsOrgId}
                onChange={(e) => setAddWsOrgId(e.target.value)}
                className="flex-1 px-2 py-1.5 text-[13px] rounded-btn border border-line bg-surface text-ink"
              >
                <option value="">In organization…</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
              <select
                value={addWsId}
                onChange={(e) => setAddWsId(e.target.value)}
                disabled={!addWsOrgId}
                className="flex-1 px-2 py-1.5 text-[13px] rounded-btn border border-line bg-surface text-ink disabled:opacity-50"
              >
                <option value="">Workspace…</option>
                {workspacesForAdd
                  .filter((w) => !member.ownedWorkspaceIds.includes(w.id))
                  .map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              <button
                onClick={() => { if (addWsId) addWs.mutate(addWsId); }}
                disabled={!addWsId || addWs.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-ink text-canvas rounded-btn text-[13px] font-medium disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" /> Grant
              </button>
            </div>
          </section>

          {anyError && (
            <div className="text-xs text-neg">
              {anyError instanceof Error ? anyError.message : 'Action failed.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AuditTab() {
  const { data: entries = [], isLoading } = useAdminAuditLog();
  return (
    <div className="rounded-card border border-line bg-surface overflow-hidden">
      <div className="px-5 py-4 border-b border-line-2">
        <div className="text-[15px] font-medium">Audit log</div>
        <div className="text-ink-3 text-[13px] mt-1">Role and membership changes, most recent first.</div>
      </div>
      {isLoading ? (
        <div className="p-5 text-sm text-ink-3">Loading…</div>
      ) : entries.length === 0 ? (
        <div className="p-5 text-sm text-ink-3">No actions yet.</div>
      ) : (
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-line">
              {['When', 'Who', 'Action', 'Scope'].map((h) => (
                <th key={h} className="label py-2.5 px-4 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => {
              const verb = ACTION_LABELS[e.action] ?? e.action;
              const showTarget = e.targetId !== e.actorId;
              return (
                <tr key={e.id} style={{ borderBottom: i === entries.length - 1 ? 'none' : '1px solid var(--line-2)' }}>
                  <td className="px-4 py-3 text-ink-3 text-xs whitespace-nowrap">{formatRelative(e.timestamp)}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-[13px]">{e.actorName ?? e.actorId}</div>
                    {e.actorEmail && <div className="mono text-ink-3 text-[11px] mt-0.5">{e.actorEmail}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-[13px]">
                      {verb}
                      {showTarget && (
                        <span className="text-ink-2"> {e.targetName ?? e.targetId}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink-3 text-xs">
                    {e.scopeName ? (
                      <span>
                        {e.scopeName}
                        <span className="mono text-ink-4 ml-1.5">{e.scopeType}</span>
                      </span>
                    ) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function useAdminAuditLog() {
  return useQuery({
    queryKey: ['admin-audit'],
    queryFn: () => apiGet<AuditEntry[]>('/api/v1/admin/role-audit'),
    staleTime: 30_000,
  });
}

// ── Domain rules tab ──────────────────────────────────────────────────────

interface DomainRuleRow {
  id: string;
  emailDomain: string;
  orgId: string;
  workspaceId: string;
}

function DomainRulesTab() {
  const qc = useQueryClient();
  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['admin-domain-rules'],
    queryFn: () => apiGet<DomainRuleRow[]>('/api/v1/admin/domain-rules'),
    staleTime: 30_000,
  });
  const { data: orgs = [] } = useAdminOrgList();

  const [domain, setDomain] = useState('');
  const [orgId, setOrgId] = useState('');
  const [workspaceId, setWorkspaceId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { data: workspaces = [] } = useWorkspaceList(orgId || null);

  useEffect(() => {
    if (!orgId && orgs.length > 0) setOrgId(orgs[0].id);
  }, [orgs, orgId]);
  useEffect(() => {
    if (workspaces.length === 0) { setWorkspaceId(''); return; }
    if (!workspaces.some((w) => w.id === workspaceId)) setWorkspaceId(workspaces[0].id);
  }, [workspaces, workspaceId]);

  const create = useMutation({
    mutationFn: () => apiPost<DomainRuleRow>('/api/v1/admin/domain-rules', {
      emailDomain: domain.trim().toLowerCase().replace(/^@/, ''),
      orgId,
      workspaceId,
    }),
    onSuccess: () => {
      setDomain(''); setError(null);
      void qc.invalidateQueries({ queryKey: ['admin-domain-rules'] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Failed to create rule'),
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiDelete<{ ok: boolean }>(`/api/v1/admin/domain-rules/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-domain-rules'] }),
  });

  const orgById = useMemo(() => new Map(orgs.map((o) => [o.id, o])), [orgs]);

  return (
    <div>
      <div className="rounded-card border border-line bg-surface mb-4 p-4">
        <div className="text-[15px] font-medium mb-2.5">Add rule</div>
        <div className="text-ink-3 text-xs mb-3 leading-relaxed">
          New sign-ups whose email matches the domain are auto-assigned to the
          chosen organization and workspace as a Developer. Rules only affect
          users at first sign-in — existing users are not retroactively moved.
        </div>
        <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
          <div>
            <label className="label block mb-1.5">Email domain</label>
            <input
              value={domain}
              onChange={(e) => { setDomain(e.target.value); setError(null); }}
              placeholder="acme.com"
              className="w-full px-2 py-1.5 text-[13px] mono rounded-btn border border-line bg-surface text-ink placeholder:text-ink-3 focus:outline-none"
            />
          </div>
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
          <button
            onClick={() => create.mutate()}
            disabled={!domain.trim() || !orgId || !workspaceId || create.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-ink text-canvas rounded-btn text-[13px] font-medium disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        </div>
        {error && <div className="mt-2 text-xs text-neg">{error}</div>}
      </div>

      <div className="rounded-card border border-line bg-surface overflow-hidden">
        <div className="px-5 py-4 border-b border-line-2">
          <div className="text-[15px] font-medium">Active rules</div>
          <div className="text-ink-3 text-[13px] mt-1">{rules.length} rule{rules.length === 1 ? '' : 's'} configured.</div>
        </div>
        {isLoading ? (
          <div className="p-5 text-sm text-ink-3">Loading…</div>
        ) : rules.length === 0 ? (
          <div className="p-5 text-sm text-ink-3">No domain rules yet.</div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line">
                {['Domain', 'Organization', 'Workspace', ''].map((h) => (
                  <th key={h} className="label py-2.5 px-4 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rules.map((r, i) => (
                <tr key={r.id} style={{ borderBottom: i === rules.length - 1 ? 'none' : '1px solid var(--line-2)' }}>
                  <td className="px-4 py-3 mono">@{r.emailDomain}</td>
                  <td className="px-4 py-3">{orgById.get(r.orgId)?.name ?? r.orgId}</td>
                  <td className="px-4 py-3 mono text-ink-3 text-xs">{r.workspaceId}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => { if (confirm(`Delete rule for @${r.emailDomain}?`)) remove.mutate(r.id); }}
                      className="p-1.5 text-ink-3 hover:text-neg transition-colors"
                      title="Delete rule"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
