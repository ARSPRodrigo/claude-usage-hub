import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiDelete, getUser } from '@/api/client';
import { TimeRangeSelector } from '@/components/layout/TimeRangeSelector';
import { Download, Plus, Trash2 } from 'lucide-react';
import { formatTokens, formatCost, formatRelative } from '@/lib/utils';

type TimeRange = '5h' | '24h' | '7d' | '30d' | 'all';

interface DashboardStats {
  tokensToday: number;
  costToday: number;
  activeSessions: number;
  totalSessions: number;
}

interface DeveloperStat {
  developerId: string;
  email: string;
  displayName: string;
  role?: string;
  totalTokens: number;
  costUsd: number;
  entryCount: number;
  lastSeen: string | null;
}

interface AdminOrgPageProps {
  onSelectDeveloper: (developerId: string, displayName: string) => void;
}

function HBar({ value, max, color, height = 4 }: { value: number; max: number; color: string; height?: number }) {
  return (
    <div className="bg-line-2 rounded-sm overflow-hidden w-full" style={{ height }}>
      <div className="h-full rounded-sm" style={{ width: `${max > 0 ? (value / max) * 100 : 0}%`, background: color }} />
    </div>
  );
}

const ROLE_LABEL: Record<string, string> = {
  primary_owner: 'Primary',
  owner: 'Owner',
  developer: 'Dev',
};

export function AdminOrgPage({ onSelectDeveloper }: AdminOrgPageProps) {
  const qc = useQueryClient();
  const currentUser = getUser();
  const isOwner = currentUser?.role === 'primary_owner' || currentUser?.role === 'owner';
  const [range, setRange] = useState<TimeRange>('7d');
  const [wipingId, setWipingId] = useState<string | null>(null);

  const wipeDeveloper = useMutation({
    mutationFn: (developerId: string) =>
      apiDelete<{ ok: boolean; deletedCount: number }>(`/api/v1/admin/developers/${developerId}/data`),
    onSuccess: () => {
      setWipingId(null);
      void qc.invalidateQueries({ queryKey: ['admin-dev-stats'] });
      void qc.invalidateQueries({ queryKey: ['admin-overview'] });
    },
  });

  const { data: devStats = [] } = useQuery({
    queryKey: ['admin-dev-stats', range],
    queryFn: () => apiGet<DeveloperStat[]>('/api/v1/admin/stats/developers', { range }),
  });

  const totalCost = devStats.reduce((s, d) => s + d.costUsd, 0);
  const totalTokens = devStats.reduce((s, d) => s + d.totalTokens, 0);
  const maxTokens = Math.max(...devStats.map((d) => d.totalTokens), 1);

  return (
    <div>
      {/* Page header */}
      <div className="flex items-end justify-between mb-6 gap-5 flex-wrap">
        <div>
          <div className="label mb-2">ORGANIZATION · /ADMIN</div>
          <h1 className="text-title m-0" style={{ fontSize: 36, lineHeight: 1.05 }}>Team overview</h1>
          <div className="text-ink-3 mt-2 text-sm">
            How your organization is using Claude, by developer.
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-line bg-surface rounded-btn text-[13px] font-medium text-ink cursor-pointer hover:bg-canvas-alt transition-colors">
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-ink text-canvas rounded-btn text-[13px] font-medium cursor-pointer hover:opacity-90 transition-opacity">
            <Plus className="h-3.5 w-3.5" />
            Invite
          </button>
          <TimeRangeSelector value={range} onChange={setRange} />
        </div>
      </div>

      {/* Stats strip */}
      <div
        className="grid gap-0 border border-line rounded-card bg-surface overflow-hidden mb-5"
        style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}
      >
        {[
          { l: 'Developers', v: String(devStats.length) },
          { l: 'Tokens · 30d', v: formatTokens(totalTokens) },
          { l: 'Cost · 30d', v: formatCost(totalCost) },
        ].map((s, i) => (
          <div key={i} style={{ padding: '22px', borderRight: i < 2 ? '1px solid var(--line)' : 'none' }}>
            <div className="label mb-2.5">{s.l}</div>
            <div className="mono tabular display" style={{ fontSize: 32, fontWeight: 500, letterSpacing: '-0.025em' }}>
              {s.v}
            </div>
          </div>
        ))}
      </div>

      {/* Members table */}
      <div className="rounded-card border border-line bg-surface overflow-hidden">
        <div className="px-5 py-4 border-b border-line flex items-center justify-between">
          <div>
            <div className="label">Members · last 30 days</div>
            <div className="text-[15.5px] font-medium mt-1.5">Ranked by consumption</div>
          </div>
        </div>

        {devStats.length === 0 ? (
          <p className="p-5 text-sm text-ink-3">No data yet. Invite developers and get the collector running.</p>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line">
                {['#', 'Member', 'Role', 'Tokens', 'Share', 'Cost', 'Sessions', 'Last active'].map((h, i) => (
                  <th
                    key={h}
                    className="label py-2.5 px-4"
                    style={{ textAlign: i >= 3 && i < 7 ? 'right' : 'left' }}
                  >
                    {h}
                  </th>
                ))}
                {isOwner && <th className="px-4 py-2.5" />}
              </tr>
            </thead>
            <tbody>
              {devStats.map((d, i) => {
                const pct = totalTokens > 0 ? (d.totalTokens / totalTokens) * 100 : 0;
                const isWiping = wipingId === d.developerId;
                return (
                  <tr
                    key={d.developerId}
                    className="group cursor-pointer hover:bg-canvas-alt transition-colors"
                    style={{ borderBottom: i === devStats.length - 1 ? 'none' : '1px solid var(--line-2)' }}
                    onClick={() => { if (!isWiping) onSelectDeveloper(d.developerId, d.displayName); }}
                  >
                    <td className="mono text-ink-4 text-[11px] px-4 py-3.5">{String(i + 1).padStart(2, '0')}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-7 h-7 rounded-full flex-shrink-0 text-white grid place-items-center text-[11px] font-semibold"
                          style={{ background: `oklch(0.7 0.12 ${(i * 55) % 360})` }}
                        >
                          {d.displayName.split(' ').map((n) => n[0]).join('')}
                        </div>
                        <div>
                          <div className="font-medium">{d.displayName}</div>
                          <div className="mono text-[10.5px] text-ink-3 mt-px">{d.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className="mono text-[10.5px] px-2 py-0.5 rounded-pill border border-line text-ink-2"
                        style={{ letterSpacing: '0.05em', textTransform: 'uppercase' }}
                      >
                        {ROLE_LABEL[d.role ?? ''] ?? d.role ?? 'Dev'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right mono tabular">{formatTokens(d.totalTokens)}</td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <div className="w-[60px]">
                          <HBar value={d.totalTokens} max={maxTokens} color="var(--ink)" />
                        </div>
                        <span className="mono tabular text-xs text-ink-2 min-w-[38px] text-right">
                          {pct.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right mono tabular">{formatCost(d.costUsd)}</td>
                    <td className="px-4 py-3.5 text-right mono tabular">{d.entryCount}</td>
                    <td className="px-4 py-3.5 text-ink-3 text-xs">
                      {d.lastSeen ? formatRelative(d.lastSeen) : 'Never'}
                    </td>
                    {isOwner && (
                      <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        {isWiping ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-xs text-neg">Wipe data?</span>
                            <button
                              onClick={() => wipeDeveloper.mutate(d.developerId)}
                              disabled={wipeDeveloper.isPending}
                              className="text-xs px-2 py-1 rounded bg-neg text-white disabled:opacity-50"
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => setWipingId(null)}
                              className="text-xs px-2 py-1 rounded border border-line text-ink"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setWipingId(d.developerId)}
                            className="p-1.5 text-ink-4 hover:text-neg transition-colors opacity-0 group-hover:opacity-100"
                            title={`Wipe ${d.displayName}'s data`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
