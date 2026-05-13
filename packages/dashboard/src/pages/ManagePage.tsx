import { useState } from 'react';
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Building2, Layers, FileClock } from 'lucide-react';
import { apiGet, apiPost, apiDelete } from '@/api/client';
import { useAdminOrgList, useAdminWorkspaceList, type OrgRow, type WorkspaceRow } from '@/api/hooks';
import { formatRelative } from '@/lib/utils';
import { cn } from '@/lib/utils';

type Tab = 'orgs' | 'workspaces' | 'audit';

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

export function ManagePage() {
  const [tab, setTab] = useState<Tab>('orgs');

  return (
    <div>
      {/* Page header */}
      <div className="mb-6">
        <div className="label mb-2">ORGANIZATION</div>
        <h1 className="text-title m-0" style={{ fontSize: 36, lineHeight: 1.05 }}>Manage</h1>
        <div className="text-ink-3 mt-2 text-sm">Create and organize organizations, workspaces, and members.</div>
      </div>

      {/* Tab strip */}
      <div className="flex gap-1 mb-5 border-b border-line">
        {([
          { id: 'orgs' as Tab, label: 'Organizations', Icon: Building2 },
          { id: 'workspaces' as Tab, label: 'Workspaces', Icon: Layers },
          { id: 'audit' as Tab, label: 'Audit log', Icon: FileClock },
        ]).map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3.5 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors',
              tab === id
                ? 'border-ink text-ink'
                : 'border-transparent text-ink-3 hover:text-ink',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'orgs' && <OrgsTab />}
      {tab === 'workspaces' && <WorkspacesTab />}
      {tab === 'audit' && <AuditTab />}
    </div>
  );
}

// ── Organizations tab ──────────────────────────────────────────────────────

function OrgsTab() {
  const qc = useQueryClient();
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
      {/* Create card */}
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

      {/* List */}
      <div className="rounded-card border border-line bg-surface overflow-hidden">
        <div className="px-5 py-4 border-b border-line-2">
          <div className="text-[15px] font-medium">All organizations</div>
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
              {['When', 'Action', 'Scope'].map((h) => (
                <th key={h} className="label py-2.5 px-4 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr key={e.id} style={{ borderBottom: i === entries.length - 1 ? 'none' : '1px solid var(--line-2)' }}>
                <td className="px-4 py-3 text-ink-3 text-xs">{formatRelative(e.timestamp)}</td>
                <td className="px-4 py-3 mono text-xs">{e.action}</td>
                <td className="px-4 py-3 text-ink-3 text-xs">
                  {e.scopeType ? `${e.scopeType}:${e.scopeId}` : '—'}
                </td>
              </tr>
            ))}
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
