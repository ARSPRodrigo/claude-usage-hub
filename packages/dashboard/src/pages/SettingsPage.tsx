import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getUser } from '@/api/client';
import { useAdminSettings } from '@/api/hooks';

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

async function apiDelete<T>(path: string): Promise<T> {
  const url = new URL(path, window.location.origin);
  const token = localStorage.getItem('chub_token');
  const response = await fetch(url.toString(), {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Server error ${response.status}: ${text || response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export function SettingsPage() {
  const user = getUser();
  const qc = useQueryClient();
  const isOwner = user?.role === 'primary_owner' || user?.role === 'owner';
  const [retentionInput, setRetentionInput] = useState<string>('');
  const [wipeConfirm, setWipeConfirm] = useState(false);

  const settings = useAdminSettings();

  const saveRetention = useMutation({
    mutationFn: (retentionDays: number) =>
      apiPatch<{ ok: boolean }>('/api/v1/admin/settings', { retentionDays }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-settings'] });
    },
  });

  const wipeData = useMutation({
    mutationFn: () => apiDelete<{ ok: boolean; deletedCount: number }>('/api/v1/admin/data'),
    onSuccess: () => {
      setWipeConfirm(false);
      void qc.invalidateQueries({ queryKey: ['health'] });
    },
  });


  const currentRetention = settings.data?.retentionDays ?? 90;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Settings</h1>

      {/* Organization section */}
      <div className="bg-white dark:bg-dark-900 rounded-lg border border-slate-200 dark:border-dark-800">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-dark-800">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Organization</h2>
        </div>
        <div className="p-4 space-y-4">
          {settings.isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-4 w-48 rounded bg-slate-200 dark:bg-dark-700 animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">
                  Allowed domain
                </label>
                <p className="text-sm text-slate-800 dark:text-slate-200">
                  {settings.data?.allowedDomain || <span className="text-slate-400 italic">Not configured</span>}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">
                  Mode
                </label>
                <p className="text-sm text-slate-800 dark:text-slate-200 capitalize">
                  {settings.data?.mode ?? 'local'}
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Data section */}
      <div className="bg-white dark:bg-dark-900 rounded-lg border border-slate-200 dark:border-dark-800">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-dark-800">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Data retention</h2>
        </div>
        <div className="p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
            Usage data older than this many days will be pruned automatically.
          </p>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min="1"
              max="3650"
              value={retentionInput || currentRetention}
              onChange={(e) => setRetentionInput(e.target.value)}
              className="w-24 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-dark-700 bg-white dark:bg-dark-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm text-slate-500 dark:text-slate-400">days</span>
            <button
              onClick={() => {
                const val = parseInt(retentionInput || String(currentRetention), 10);
                if (!isNaN(val) && val > 0) saveRetention.mutate(val);
              }}
              disabled={saveRetention.isPending}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition-colors"
            >
              {saveRetention.isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
          {saveRetention.isSuccess && (
            <p className="mt-2 text-xs text-green-600 dark:text-green-400">Saved successfully.</p>
          )}
          {saveRetention.isError && (
            <p className="mt-2 text-xs text-red-600 dark:text-red-400">
              {saveRetention.error instanceof Error ? saveRetention.error.message : 'Failed to save'}
            </p>
          )}
        </div>
      </div>

      {/* Danger zone — owners only */}
      {isOwner && (
        <div className="bg-white dark:bg-dark-900 rounded-lg border border-red-200 dark:border-red-900/50">
          <div className="px-4 py-3 border-b border-red-200 dark:border-red-900/50">
            <h2 className="text-sm font-semibold text-red-700 dark:text-red-400">Danger zone</h2>
          </div>
          <div className="p-4">
            <p className="text-sm text-slate-700 dark:text-slate-300 mb-1">Wipe all usage data</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Permanently delete all usage entries from the database. This cannot be undone.
            </p>
            {!wipeConfirm ? (
              <button
                onClick={() => setWipeConfirm(true)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg font-medium transition-colors"
              >
                Wipe all usage data
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <p className="text-sm text-red-700 dark:text-red-400 font-medium">Are you sure? This cannot be undone.</p>
                <button
                  onClick={() => wipeData.mutate()}
                  disabled={wipeData.isPending}
                  className="px-4 py-2 bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition-colors"
                >
                  {wipeData.isPending ? 'Wiping...' : 'Yes, wipe all data'}
                </button>
                <button
                  onClick={() => setWipeConfirm(false)}
                  className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  Cancel
                </button>
              </div>
            )}
            {wipeData.isSuccess && (
              <p className="mt-2 text-xs text-green-600 dark:text-green-400">
                All usage data wiped. {(wipeData.data as { ok: boolean; deletedCount: number } | undefined)?.deletedCount ?? 0} entries deleted.
              </p>
            )}
            {wipeData.isError && (
              <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                {wipeData.error instanceof Error ? wipeData.error.message : 'Failed to wipe data'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
