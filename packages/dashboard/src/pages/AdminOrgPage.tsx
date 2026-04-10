import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/api/client';
import { DollarSign, Zap, Users, TrendingUp } from 'lucide-react';

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
  totalTokens: number;
  costUsd: number;
  entryCount: number;
  lastSeen: string | null;
}

function StatCard({ label, value, sub, icon: Icon }: {
  label: string;
  value: string;
  sub?: string;
  icon: typeof DollarSign;
}) {
  return (
    <div className="bg-white dark:bg-dark-900 rounded-xl border border-slate-200 dark:border-dark-800 p-4">
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

export function AdminOrgPage() {
  const { data: overview } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => apiGet<DashboardStats>('/api/v1/admin/stats/overview'),
  });

  const { data: devStats = [] } = useQuery({
    queryKey: ['admin-dev-stats'],
    queryFn: () => apiGet<DeveloperStat[]>('/api/v1/admin/stats/developers'),
  });

  const totalCost = devStats.reduce((s, d) => s + d.costUsd, 0);
  const totalTokens = devStats.reduce((s, d) => s + d.totalTokens, 0);
  const activeDevs = devStats.filter((d) => d.entryCount > 0).length;

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Org Overview</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total cost" value={`$${totalCost.toFixed(2)}`} icon={DollarSign} />
        <StatCard label="Total tokens" value={fmt(totalTokens)} icon={Zap} />
        <StatCard label="Active developers" value={String(activeDevs)} sub={`of ${devStats.length} members`} icon={Users} />
        <StatCard label="Today's cost" value={`$${(overview?.costToday ?? 0).toFixed(2)}`} icon={TrendingUp} />
      </div>

      {/* Per-developer breakdown */}
      <div className="bg-white dark:bg-dark-900 rounded-xl border border-slate-200 dark:border-dark-800">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-dark-800">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Per-developer usage</h2>
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
                  <th className="text-right px-4 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">Last seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-dark-800">
                {devStats.map((d) => {
                  const pct = totalCost > 0 ? (d.costUsd / totalCost) * 100 : 0;
                  return (
                    <tr key={d.developerId} className="hover:bg-slate-50 dark:hover:bg-dark-800/50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800 dark:text-slate-200">{d.displayName}</p>
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
                      <td className="px-4 py-3 text-right text-xs text-slate-400">
                        {d.lastSeen
                          ? new Date(d.lastSeen).toLocaleDateString()
                          : <span className="text-slate-300 dark:text-dark-600">—</span>}
                      </td>
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
