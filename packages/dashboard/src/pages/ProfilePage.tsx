import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiDelete, getUser } from '@/api/client';

interface ApiKeyRow {
  id: string;
  keyPrefix: string;
  label: string;
  developerId: string;
  createdAt: string;
  revokedAt: string | null;
}

interface NewKeyResponse {
  id: string;
  key: string;
  keyPrefix: string;
  label: string;
  developerId: string;
}

type Platform = 'mac' | 'linux' | 'linux-vm' | 'windows';

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

export function ProfilePage() {
  const user = getUser();
  const qc = useQueryClient();
  const serverUrl = window.location.origin;
  const [newLabel, setNewLabel] = useState('');
  const [platform, setPlatform] = useState<Platform>('mac');
  const [newKey, setNewKey] = useState<NewKeyResponse | null>(null);
  const [revokeConfirm, setRevokeConfirm] = useState<string | null>(null);

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

  const activeKeys = keys.filter((k) => !k.revokedAt);
  const revokedKeys = keys.filter((k) => k.revokedAt);

  const installCmd: Record<Platform, string> = {
    mac: `curl -sSL ${serverUrl}/install.sh | CHUB_API_KEY=${newKey?.key ?? 'chub_...'} sh`,
    linux: `curl -sSL ${serverUrl}/install.sh | CHUB_API_KEY=${newKey?.key ?? 'chub_...'} sh`,
    'linux-vm': `# SSH into your VM, then:\ncurl -sSL ${serverUrl}/install.sh | CHUB_API_KEY=${newKey?.key ?? 'chub_...'} sh`,
    windows: `$env:CHUB_API_KEY="${newKey?.key ?? 'chub_...'}"; irm ${serverUrl}/install.ps1 | iex`,
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Profile</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{user?.email}</p>
      </div>

      {/* Active machines */}
      <div className="bg-white dark:bg-dark-900 rounded-xl border border-slate-200 dark:border-dark-800">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-dark-800">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Active machines</h2>
        </div>
        {activeKeys.length === 0 ? (
          <p className="p-4 text-sm text-slate-400">No active API keys.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-dark-800">
            {activeKeys.map((k) => (
              <li key={k.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{k.label}</p>
                  <p className="text-xs text-slate-400 font-mono">{k.keyPrefix}…</p>
                  <p className="text-xs text-slate-400">Added {new Date(k.createdAt).toLocaleDateString()}</p>
                </div>
                {revokeConfirm === k.id ? (
                  <div className="flex gap-2">
                    <button onClick={() => revokeKey.mutate(k.id)} className="text-xs text-red-600 dark:text-red-400 font-medium hover:underline">Confirm revoke</button>
                    <button onClick={() => setRevokeConfirm(null)} className="text-xs text-slate-400 hover:underline">Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setRevokeConfirm(k.id)} className="text-xs text-slate-400 hover:text-red-500 transition-colors">Revoke</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Generate new key */}
      <div className="bg-white dark:bg-dark-900 rounded-xl border border-slate-200 dark:border-dark-800 p-4">
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
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">⚠ Save this key — shown once</p>
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
        <div className="bg-white dark:bg-dark-900 rounded-xl border border-slate-200 dark:border-dark-800">
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
