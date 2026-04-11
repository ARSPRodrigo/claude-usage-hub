import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiDelete, getUser } from '@/api/client';
import { TimeRangeSelector } from '@/components/layout/TimeRangeSelector';
import { DollarSign, Zap, Users, TrendingUp, Trash2 } from 'lucide-react';

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

function StatCard({ label, value, sub, icon: Icon }: {
  label: string;
  value: string;
  sub?: string;
  icon: typeof DollarSign;
}) {
  return (
    <div className="bg-white dark:bg-dark-900 rounded-lg border border-slate-200 dark:border-dark-800 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</span>
        <Icon className="h-4 w-4 text-slate-400" />
      </div>
      <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function getActivityStatus(lastSeen: string | null): { dotClass: string; label: string } {
  if (!lastSeen) return { dotClass: 'bg-red-500', label: 'Inactive' };

  const now = new Date();
  const seen = new Date(lastSeen);
  const diffMs = now.getTime() - seen.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays < 1) return { dotClass: 'bg-green-500', label: 'Active today' };
  if (diffDays < 7) return { dotClass: 'bg-yellow-500', label: 'Active this week' };
  if (diffDays < 30) return { dotClass: 'bg-slate-400', label: 'This month' };
  return { dotClass: 'bg-red-500', label: 'Inactive' };
}

const ROLE_BADGE: Record<string, string> = {
  primary_owner: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
  owner: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  developer: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
};

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

  const { data: overview } = useQuery({
    queryKey: ['admin-overview', range],
    queryFn: () => apiGet<DashboardStats>('/api/v1/admin/stats/overview', { range }),
  });

  const { data: devStats = [] } = useQuery({
    queryKey: ['admin-dev-stats', range],
    queryFn: () => apiGet<DeveloperStat[]>('/api/v1/admin/stats/developers', { range }),
  });

  const totalCost = devStats.reduce((s, d) => s + d.costUsd, 0);
  const totalTokens = devStats.reduce((s, d) => s + d.totalTokens, 0);
  const activeDevs = devStats.filter((d) => d.entryCount > 0).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Overview</h1>
        <TimeRangeSelector value={range} onChange={setRange} />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total cost" value={`$${totalCost.toFixed(2)}`} icon={DollarSign} />
        <StatCard label="Total tokens" value={fmt(totalTokens)} icon={Zap} />
        <StatCard label="Active members" value={String(activeDevs)} sub={`of ${devStats.length} total`} icon={Users} />
        <StatCard label="Today's cost" value={`$${(overview?.costToday ?? 0).toFixed(2)}`} icon={TrendingUp} />
      </div>

      {/* Per-developer breakdown */}
      <div className="bg-white dark:bg-dark-900 rounded-lg border border-slate-200 dark:border-dark-800">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-dark-800">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Per-member usage</h2>
        </div>

        {devStats.length === 0 ? (
          <p className="p-4 text-sm text-slate-400">No data yet. Invite developers and get the collector running.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-dark-800">
                  <th className="text-left px-4 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">Developer</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">Tokens</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">Cost</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">% of total</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">Status</th>
                  {isOwner && <th className="px-4 py-2" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-dark-800">
                {devStats.map((d) => {
                  const pct = totalCost > 0 ? (d.costUsd / totalCost) * 100 : 0;
                  const activity = getActivityStatus(d.lastSeen);
                  const roleBadge = d.role ? ROLE_BADGE[d.role] : ROLE_BADGE['developer'];
                  const roleLabel = d.role ? ROLE_LABEL[d.role] : 'Dev';
                  const isWiping = wipingId === d.developerId;
                  return (
                    <tr
                      key={d.developerId}
                      className="group hover:bg-slate-50 dark:hover:bg-dark-800/50 cursor-pointer"
                      onClick={() => { if (!isWiping) onSelectDeveloper(d.developerId, d.displayName); }}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-slate-800 dark:text-slate-200">{d.displayName}</p>
                          {d.role && (
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${roleBadge}`}>
                              {roleLabel}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400">{d.email}</p>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300 tabular-nums">
                        {fmt(d.totalTokens)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300 tabular-nums">
                        ${d.costUsd.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-slate-100 dark:bg-dark-700 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-blue-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs tabular-nums text-slate-500 w-8 text-right">
                            {pct.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <div className={`h-2 w-2 rounded-full flex-shrink-0 ${activity.dotClass}`} />
                          <span className="text-xs text-slate-500">{activity.label}</span>
                        </div>
                      </td>
                      {isOwner && (
                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          {isWiping ? (
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-xs text-red-600 dark:text-red-400">Wipe data?</span>
                              <button
                                onClick={() => wipeDeveloper.mutate(d.developerId)}
                                disabled={wipeDeveloper.isPending}
                                className="text-xs px-2 py-1 rounded bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
                              >
                                Yes
                              </button>
                              <button
                                onClick={() => setWipingId(null)}
                                className="text-xs px-2 py-1 rounded bg-slate-200 dark:bg-dark-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-dark-600"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setWipingId(d.developerId)}
                              className="p-1.5 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
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
              <tfoot>
                <tr className="border-t border-slate-200 dark:border-dark-700 bg-slate-50 dark:bg-dark-800/50">
                  <td className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400">Total</td>
                  <td className="px-4 py-2 text-right text-xs font-semibold text-slate-600 dark:text-slate-400 tabular-nums">{fmt(totalTokens)}</td>
                  <td className="px-4 py-2 text-right text-xs font-semibold text-slate-600 dark:text-slate-400 tabular-nums">${totalCost.toFixed(2)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
