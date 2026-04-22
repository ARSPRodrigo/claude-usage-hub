import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiDelete, getUser, setUser } from '@/api/client';
import { Pencil, Plus, Copy } from 'lucide-react';
import { formatRelative } from '@/lib/utils';

interface ApiKeyRow {
  id: string;
  keyPrefix: string;
  label: string;
  developerId: string;
  createdAt: string;
  revokedAt: string | null;
  lastUsedAt?: string | null;
}

interface NewKeyResponse {
  id: string;
  key: string;
  keyPrefix: string;
  label: string;
  developerId: string;
}

type Platform = 'mac' | 'linux' | 'linux-vm' | 'windows';

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

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1400); }); }}
      className="bg-transparent border-none cursor-pointer text-ink-3 p-0.5 grid place-items-center hover:text-ink-2 transition-colors"
    >
      {copied ? (
        <span className="mono text-pos text-[10px]" style={{ letterSpacing: '0.05em' }}>COPIED</span>
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

const ROLE_LABELS: Record<string, string> = {
  primary_owner: 'Primary Owner',
  owner: 'Owner',
  developer: 'Developer',
};

export function ProfilePage() {
  const user = getUser();
  const qc = useQueryClient();
  const serverUrl = window.location.origin;
  const [newLabel, setNewLabel] = useState('');
  const [platform, setPlatform] = useState<Platform>('mac');
  const [newKey, setNewKey] = useState<NewKeyResponse | null>(null);
  const [revokeConfirm, setRevokeConfirm] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(user?.displayName ?? '');

  const { data: keys = [] } = useQuery({
    queryKey: ['my-api-keys'],
    queryFn: () => apiGet<ApiKeyRow[]>('/api/v1/profile/api-keys'),
  });

  const generateKey = useMutation({
    mutationFn: (label: string) =>
      apiPost<NewKeyResponse>('/api/v1/profile/api-keys', { label }),
    onSuccess: (data) => {
      setNewKey(data);
      setNewLabel('');
      void qc.invalidateQueries({ queryKey: ['my-api-keys'] });
    },
  });

  const revokeKey = useMutation({
    mutationFn: (id: string) => apiDelete<{ ok: boolean }>(`/api/v1/profile/api-keys/${id}`),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['my-api-keys'] }); setRevokeConfirm(null); },
  });

  const updateDisplayName = useMutation({
    mutationFn: (displayName: string) =>
      apiPatch<{ id: string; email: string; displayName: string; role: string; developerId: string }>(
        '/api/v1/profile',
        { displayName },
      ),
    onSuccess: (data) => {
      if (user) setUser({ ...user, displayName: data.displayName });
      setEditingName(false);
    },
  });

  const initials = user?.displayName
    ? user.displayName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() ?? '?';

  const activeKeys = keys.filter((k) => !k.revokedAt);

  const installCmd: Record<Platform, string> = {
    mac: `curl -sSL ${serverUrl}/install.sh | CHUB_API_KEY=${newKey?.key ?? 'chub_...'} sh`,
    linux: `curl -sSL ${serverUrl}/install.sh | CHUB_API_KEY=${newKey?.key ?? 'chub_...'} sh`,
    'linux-vm': `# SSH into your VM, then:\ncurl -sSL ${serverUrl}/install.sh | CHUB_API_KEY=${newKey?.key ?? 'chub_...'} sh`,
    windows: `$env:CHUB_API_KEY="${newKey?.key ?? 'chub_...'}"; irm ${serverUrl}/install.ps1 | iex`,
  };

  return (
    <div>
      {/* Page header */}
      <div className="mb-6">
        <div className="label mb-2">ACCOUNT · /PROFILE</div>
        <h1 className="text-title m-0" style={{ fontSize: 36, lineHeight: 1.05 }}>Profile & keys</h1>
        <div className="text-ink-3 mt-2 text-sm">
          Your identity and the API keys your machines use to report usage.
        </div>
      </div>

      {/* Two-card top row */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Identity card */}
        <div className="rounded-card border border-line bg-surface">
          <div className="px-5 py-4 border-b border-line-2">
            <div className="label">A1 · Identity</div>
            <div className="text-[15.5px] font-medium mt-1.5">Signed in via Google</div>
          </div>
          <div className="p-5 flex gap-4 items-center">
            <div
              className="w-14 h-14 rounded-full text-white grid place-items-center text-xl font-semibold flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, var(--accent) 0%, oklch(0.55 0.15 30) 100%)' }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              {editingName ? (
                <div className="flex gap-2 items-center">
                  <input
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-sm rounded-btn border border-line bg-surface text-ink focus:outline-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && nameInput.trim()) updateDisplayName.mutate(nameInput.trim());
                      if (e.key === 'Escape') setEditingName(false);
                    }}
                    autoFocus
                  />
                  <button
                    onClick={() => { if (nameInput.trim()) updateDisplayName.mutate(nameInput.trim()); }}
                    className="px-3 py-1.5 bg-ink text-canvas rounded-btn text-xs font-medium"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="text-[17px] font-semibold" style={{ letterSpacing: '-0.01em' }}>
                    {user?.displayName || 'Not set'}
                  </div>
                  <button
                    onClick={() => { setEditingName(true); setNameInput(user?.displayName ?? ''); }}
                    className="p-1 text-ink-3 hover:text-ink transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              <div className="mono text-xs text-ink-3 mt-1">{user?.email}</div>
              <div className="flex gap-1.5 mt-2.5">
                <span
                  className="mono text-[10px] px-2 py-0.5 rounded-pill border border-line text-ink-2"
                  style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}
                >
                  {ROLE_LABELS[user?.role ?? ''] ?? user?.role}
                </span>
                <span
                  className="mono text-[10px] px-2 py-0.5 rounded-pill text-pos"
                  style={{ letterSpacing: '0.06em', textTransform: 'uppercase', background: 'color-mix(in oklch, var(--pos) 14%, transparent)' }}
                >
                  Domain verified
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Personal usage card */}
        <div className="rounded-card border border-line bg-surface">
          <div className="px-5 py-4 border-b border-line-2">
            <div className="label">A2 · Your usage · 30d</div>
            <div className="text-[15.5px] font-medium mt-1.5">Across all machines</div>
          </div>
          <div className="p-5 grid grid-cols-3 gap-3.5">
            {[
              { l: 'Tokens', v: '—' },
              { l: 'Cost', v: '—' },
              { l: 'Sessions', v: String(activeKeys.length) },
            ].map((x) => (
              <div key={x.l}>
                <div className="label mb-1.5">{x.l}</div>
                <div className="mono tabular text-[22px] font-medium" style={{ letterSpacing: '-0.015em' }}>
                  {x.v}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* API keys table */}
      <div className="rounded-card border border-line bg-surface mb-4">
        <div className="px-5 py-4 border-b border-line flex items-center justify-between">
          <div>
            <div className="label">A3 · API keys</div>
            <div className="text-[15.5px] font-medium mt-1.5" style={{ letterSpacing: '-0.01em' }}>One per machine</div>
          </div>
          {!newKey && (
            <div className="flex gap-2">
              <input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Machine name"
                className="px-3 py-1.5 text-[13px] rounded-btn border border-line bg-surface text-ink placeholder:text-ink-3 focus:outline-none w-48"
              />
              <button
                onClick={() => { if (newLabel.trim()) generateKey.mutate(newLabel.trim()); }}
                disabled={!newLabel.trim() || generateKey.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-ink text-canvas rounded-btn text-[13px] font-medium disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
                Generate key
              </button>
            </div>
          )}
        </div>

        {newKey && (
          <div className="px-5 py-4 border-b border-line-2" style={{ background: 'color-mix(in oklch, var(--accent) 6%, transparent)' }}>
            <p className="text-xs font-semibold mb-1" style={{ color: 'var(--accent)' }}>Save this key — shown once</p>
            <div className="flex items-center gap-2">
              <code className="mono text-xs flex-1 break-all">{newKey.key}</code>
              <CopyButton text={newKey.key} />
            </div>
            <div className="flex gap-1 mt-3 mb-2">
              {(['mac', 'linux', 'linux-vm', 'windows'] as Platform[]).map((p) => (
                <button key={p} onClick={() => setPlatform(p)}
                  className="mono px-2 py-1 text-[10.5px] rounded-pill border border-line cursor-pointer"
                  style={{
                    background: platform === p ? 'var(--ink)' : 'var(--surface)',
                    color: platform === p ? 'var(--bg)' : 'var(--ink-2)',
                    letterSpacing: '0.04em',
                  }}>
                  {p === 'linux-vm' ? 'LINUX VM' : p.toUpperCase()}
                </button>
              ))}
            </div>
            <div className="relative rounded-btn bg-ink text-canvas p-3.5 mt-1">
              <pre className="mono text-xs whitespace-pre-wrap break-all pr-14">{installCmd[platform]}</pre>
            </div>
            <button onClick={() => setNewKey(null)} className="text-xs text-ink-3 hover:text-ink underline mt-2">Done — dismiss</button>
          </div>
        )}

        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-line">
              {['Label', 'Key', 'Machine', 'Created', 'Last used', ''].map((h) => (
                <th key={h} className="label text-left py-2.5 px-4">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeKeys.map((k, i) => (
              <tr key={k.id} style={{ borderBottom: i === activeKeys.length - 1 ? 'none' : '1px solid var(--line-2)' }}>
                <td className="px-4 py-3.5 font-medium">{k.label}</td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    <code className="mono text-xs bg-canvas-alt px-2 py-0.5 rounded-pill border border-line">
                      {k.keyPrefix}…
                    </code>
                    <CopyButton text={k.keyPrefix} />
                  </div>
                </td>
                <td className="px-4 py-3.5 mono text-ink-2">{k.label}</td>
                <td className="px-4 py-3.5 text-ink-3 text-xs">{formatRelative(k.createdAt)}</td>
                <td className="px-4 py-3.5 text-ink-3 text-xs">{formatRelative(k.lastUsedAt ?? '')}</td>
                <td className="px-4 py-3.5 text-right">
                  {revokeConfirm === k.id ? (
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => revokeKey.mutate(k.id)} className="text-xs text-neg font-medium">Confirm</button>
                      <button onClick={() => setRevokeConfirm(null)} className="text-xs text-ink-3">Cancel</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setRevokeConfirm(k.id)}
                      className="text-[11.5px] border border-line rounded-btn px-2.5 py-1 text-neg cursor-pointer bg-transparent hover:bg-canvas-alt transition-colors"
                    >
                      Revoke
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Danger zone */}
      <div className="rounded-card bg-surface p-5" style={{ border: '1px solid color-mix(in oklch, var(--neg) 20%, var(--line))' }}>
        <div className="flex items-center justify-between gap-5">
          <div>
            <div className="label text-neg">Danger zone</div>
            <div className="text-[15px] font-medium mt-1.5">Wipe my usage data</div>
            <div className="text-[13px] text-ink-3 mt-1">
              Removes all token entries reported by your machines. Cannot be undone.
            </div>
          </div>
          <button className="px-3.5 py-[7px] border border-neg rounded-btn text-neg text-[13px] font-medium cursor-pointer bg-transparent hover:bg-[color-mix(in_oklch,var(--neg)_6%,transparent)] transition-colors whitespace-nowrap">
            Wipe data
          </button>
        </div>
      </div>
    </div>
  );
}
