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

async function apiDeleteFn<T>(path: string): Promise<T> {
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

const RETENTION_OPTIONS = [30, 60, 90, 180, 365];

export function SettingsPage() {
  const user = getUser();
  const qc = useQueryClient();
  const isOwner = user?.role === 'primary_owner' || user?.role === 'owner';
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
    mutationFn: () => apiDeleteFn<{ ok: boolean; deletedCount: number }>('/api/v1/admin/data'),
    onSuccess: () => {
      setWipeConfirm(false);
      void qc.invalidateQueries({ queryKey: ['health'] });
    },
  });

  const currentRetention = settings.data?.retentionDays ?? 90;

  return (
    <div>
      {/* Page header */}
      <div className="mb-6">
        <div className="label mb-2">ORGANIZATION · /SETTINGS</div>
        <h1 className="text-title m-0" style={{ fontSize: 36, lineHeight: 1.05 }}>Settings</h1>
        <div className="text-ink-3 mt-2 text-sm">Retention, auth and data policies.</div>
      </div>

      {/* Data retention card */}
      <div className="rounded-card border border-line bg-surface mb-4">
        <div className="p-5">
          <div className="text-[15px] font-medium mb-3">Data retention</div>
          <div className="text-ink-3 text-[13px] mb-4">
            Automatically prune entries older than the retention window. Default is 90 days.
          </div>
          <div className="flex gap-2">
            {RETENTION_OPTIONS.map((d) => (
              <button
                key={d}
                onClick={() => saveRetention.mutate(d)}
                disabled={saveRetention.isPending}
                className="mono px-3.5 py-2 border border-line rounded-btn text-[11.5px] font-medium cursor-pointer transition-colors"
                style={{
                  letterSpacing: '0.04em',
                  background: d === currentRetention ? 'var(--ink)' : 'var(--surface)',
                  color: d === currentRetention ? 'var(--bg)' : 'var(--ink)',
                }}
              >
                {d} DAYS
              </button>
            ))}
          </div>
          {saveRetention.isSuccess && (
            <p className="mt-2 text-xs text-pos">Saved successfully.</p>
          )}
          {saveRetention.isError && (
            <p className="mt-2 text-xs text-neg">
              {saveRetention.error instanceof Error ? saveRetention.error.message : 'Failed to save'}
            </p>
          )}
        </div>
      </div>

      {/* Danger zone */}
      {isOwner && (
        <div className="rounded-card bg-surface p-5" style={{ border: '1px solid color-mix(in oklch, var(--neg) 20%, var(--line))' }}>
          <div className="label text-neg mb-2">Danger zone</div>
          <div className="text-[15px] font-medium mb-1">Wipe all usage data</div>
          <div className="text-[13px] text-ink-3 mb-4">
            Permanently delete all usage entries from the database. This cannot be undone.
          </div>
          {!wipeConfirm ? (
            <button
              onClick={() => setWipeConfirm(true)}
              className="px-3.5 py-[7px] border border-neg rounded-btn text-neg text-[13px] font-medium cursor-pointer bg-transparent hover:bg-[color-mix(in_oklch,var(--neg)_6%,transparent)] transition-colors"
            >
              Wipe all usage data
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <p className="text-sm text-neg font-medium">Are you sure? This cannot be undone.</p>
              <button
                onClick={() => wipeData.mutate()}
                disabled={wipeData.isPending}
                className="px-3 py-1.5 bg-neg text-white rounded-btn text-[13px] font-medium disabled:opacity-50"
              >
                {wipeData.isPending ? 'Wiping...' : 'Yes, wipe all data'}
              </button>
              <button
                onClick={() => setWipeConfirm(false)}
                className="text-sm text-ink-3 hover:text-ink transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
          {wipeData.isSuccess && (
            <p className="mt-2 text-xs text-pos">
              All usage data wiped. {(wipeData.data as { ok: boolean; deletedCount: number } | undefined)?.deletedCount ?? 0} entries deleted.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
