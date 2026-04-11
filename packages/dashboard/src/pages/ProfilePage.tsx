import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiDelete, getUser, setUser } from '@/api/client';
import { Pencil } from 'lucide-react';

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
      onClick={() => { navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); }}
      className="px-2 py-1 text-xs rounded bg-slate-200 dark:bg-dark-700 hover:bg-slate-300 dark:hover:bg-dark-600 text-slate-700 dark:text-slate-300 transition-colors"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

function relativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Never';
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

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
      if (user) {
        setUser({ ...user, displayName: data.displayName });
      }
      setEditingName(false);
    },
  });

  const activeKeys = keys.filter((k) => !k.revokedAt);
  const revokedKeys = keys.filter((k) => k.revokedAt);

  const installCmd: Record<Platform, string> = {
    mac: `curl -sSL ${serverUrl}/install.sh | CHUB_API_KEY=${newKey?.key ?? 'chub_...'} sh`,
    linux: `curl -sSL ${serverUrl}/install.sh | CHUB_API_KEY=${newKey?.key ?? 'chub_...'} sh`,
    'linux-vm': `# SSH into your VM, then:\ncurl -sSL ${serverUrl}/install.sh | CHUB_API_KEY=${newKey?.key ?? 'chub_...'} sh`,
    windows: `$env:CHUB_API_KEY="${newKey?.key ?? 'chub_...'}"; irm ${serverUrl}/install.ps1 | iex`,
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Profile</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{user?.email}</p>
      </div>

      {/* Display name */}
      <div className="bg-white dark:bg-dark-900 rounded-lg border border-slate-200 dark:border-dark-800 p-4">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Display name</h2>
        {editingName ? (
          <div className="flex gap-2 items-center">
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-dark-700 bg-white dark:bg-dark-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && nameInput.trim()) updateDisplayName.mutate(nameInput.trim());
                if (e.key === 'Escape') setEditingName(false);
              }}
              autoFocus
            />
            <button
              onClick={() => { if (nameInput.trim()) updateDisplayName.mutate(nameInput.trim()); }}
              disabled={!nameInput.trim() || updateDisplayName.isPending}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition-colors"
            >
              Save
            </button>
            <button
              onClick={() => { setEditingName(false); setNameInput(user?.displayName ?? ''); }}
              className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-800 dark:text-slate-200">
              {user?.displayName || <span className="text-slate-400 italic">Not set</span>}
            </span>
            <button
              onClick={() => { setEditingName(true); setNameInput(user?.displayName ?? ''); }}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              title="Edit display name"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        {updateDisplayName.isError && (
          <p className="mt-2 text-xs text-red-600 dark:text-red-400">
            {updateDisplayName.error instanceof Error ? updateDisplayName.error.message : 'Failed to update name'}
          </p>
        )}
      </div>

      {/* Active machines */}
      <div className="bg-white dark:bg-dark-900 rounded-lg border border-slate-200 dark:border-dark-800">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-dark-800">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Active machines</h2>
        </div>
        {activeKeys.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">No active machines configured.</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">Generate an API key below to connect your first machine and start collecting usage data.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-dark-800">
                  <th className="text-left px-4 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">Machine</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">Added</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">Last used</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-dark-800">
                {activeKeys.map((k) => (
                  <tr key={k.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800 dark:text-slate-200">{k.label}</p>
                      <p className="text-xs text-slate-400 font-mono">{k.keyPrefix}…</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{new Date(k.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{relativeTime(k.lastUsedAt)}</td>
                    <td className="px-4 py-3 text-right">
                      {revokeConfirm === k.id ? (
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => revokeKey.mutate(k.id)} className="text-xs text-red-600 dark:text-red-400 font-medium hover:underline">Confirm revoke</button>
                          <button onClick={() => setRevokeConfirm(null)} className="text-xs text-slate-400 hover:underline">Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => setRevokeConfirm(k.id)} className="text-xs text-slate-400 hover:text-red-500 transition-colors">Revoke</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Get started widget when no keys */}
      {activeKeys.length === 0 && !newKey && (
        <div className="bg-cyan-50 dark:bg-cyan-900/10 rounded-lg border border-cyan-200 dark:border-cyan-800 p-5">
          <h2 className="text-sm font-semibold text-cyan-800 dark:text-cyan-300 mb-2">Get started with Claude Usage Hub</h2>
          <p className="text-xs text-cyan-700 dark:text-cyan-400 mb-4">
            Connect a machine to start collecting your Claude Code usage data. Generate an API key, then run the one-line installer on any machine where you use Claude Code.
          </p>
          <button
            onClick={() => { document.getElementById('add-machine-section')?.scrollIntoView({ behavior: 'smooth' }); }}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm rounded-lg font-medium transition-colors"
          >
            Add your first machine
          </button>
        </div>
      )}

      {/* Generate new key */}
      <div id="add-machine-section" className="bg-white dark:bg-dark-900 rounded-lg border border-slate-200 dark:border-dark-800 p-4">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Add another machine</h2>
        {!newKey ? (
          <div className="flex gap-2">
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Machine name (e.g. OCI VM, Windows PC)"
              className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-dark-700 bg-white dark:bg-dark-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => { if (newLabel.trim()) generateKey.mutate(newLabel.trim()); }}
              disabled={!newLabel.trim() || generateKey.isPending}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition-colors"
            >
              Generate key
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700">
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">Save this key — shown once</p>
              <div className="flex items-center gap-2">
                <code className="text-xs font-mono text-amber-900 dark:text-amber-200 flex-1 break-all">{newKey.key}</code>
                <CopyButton text={newKey.key} />
              </div>
            </div>

            {/* Platform install command */}
            <div>
              <div className="flex gap-1 mb-2">
                {(['mac', 'linux', 'linux-vm', 'windows'] as Platform[]).map((p) => (
                  <button key={p} onClick={() => setPlatform(p)}
                    className={`px-2 py-1 text-xs rounded ${platform === p ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-slate-400'}`}>
                    {p === 'linux-vm' ? 'Linux VM' : p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
              <div className="relative rounded-lg bg-slate-900 p-3">
                <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap break-all pr-14">{installCmd[platform]}</pre>
                <div className="absolute top-2 right-2"><CopyButton text={installCmd[platform]} /></div>
              </div>
            </div>

            <button onClick={() => setNewKey(null)} className="text-xs text-slate-400 hover:text-slate-600 underline">Done — dismiss</button>
          </div>
        )}
      </div>

      {/* Revoked keys */}
      {revokedKeys.length > 0 && (
        <div className="bg-white dark:bg-dark-900 rounded-lg border border-slate-200 dark:border-dark-800">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-dark-800">
            <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-500">Revoked machines</h2>
          </div>
          <ul className="divide-y divide-slate-100 dark:divide-dark-800">
            {revokedKeys.map((k) => (
              <li key={k.id} className="flex items-center justify-between px-4 py-3 opacity-50">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 line-through">{k.label}</p>
                  <p className="text-xs text-slate-400">Revoked {new Date(k.revokedAt!).toLocaleDateString()}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
