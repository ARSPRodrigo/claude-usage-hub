import { useState } from 'react';
import { ArrowLeft, DollarSign, Zap, Clock, Monitor, Trash2 } from 'lucide-react';
import { TimeRangeSelector } from '@/components/layout/TimeRangeSelector';
import { TokenChart } from '@/components/dashboard/TokenChart';
import { ModelMixChart } from '@/components/dashboard/ModelMixChart';
import { useDeveloperStats, useDeveloperTimeseries } from '@/api/hooks';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiDelete, getUser } from '@/api/client';

type TimeRange = '5h' | '24h' | '7d' | '30d' | 'all';

interface ModelMixEntry {
  model: string;
  totalTokens: number;
  costUsd: number;
  percentage: number;
}

interface MachineUsageStat {
  apiKeyId: string;
  label: string;
  totalTokens: number;
  costUsd: number;
  entryCount: number;
  lastSeen: string | null;
  createdAt: string;
  revokedAt: string | null;
}

interface DeveloperDetailPageProps {
  developerId: string;
  displayName: string;
  onBack: () => void;
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

export function DeveloperDetailPage({ developerId, displayName, onBack }: DeveloperDetailPageProps) {
  const qc = useQueryClient();
  const currentUser = getUser();
  const isOwner = currentUser?.role === 'primary_owner' || currentUser?.role === 'owner';
  const [range, setRange] = useState<TimeRange>('7d');
  const [wipingMachineId, setWipingMachineId] = useState<string | null>(null);

  const stats = useDeveloperStats(developerId, range);
  const timeseries = useDeveloperTimeseries(developerId, range);

  const machines = useQuery({
    queryKey: ['developer-machines', developerId],
    queryFn: () => apiGet<MachineUsageStat[]>(`/api/v1/admin/developers/${developerId}/machines`),
    enabled: isOwner,
  });

  const wipeMachine = useMutation({
    mutationFn: (apiKeyId: string) =>
      apiDelete<{ ok: boolean; deletedCount: number }>(`/api/v1/admin/api-keys/${apiKeyId}/data`),
    onSuccess: () => {
      setWipingMachineId(null);
      void qc.invalidateQueries({ queryKey: ['developer-machines', developerId] });
      void qc.invalidateQueries({ queryKey: ['developer-stats', developerId] });
      void qc.invalidateQueries({ queryKey: ['developer-timeseries', developerId] });
    },
  });

  const modelMix = useQuery({
    queryKey: ['developer-model-mix', developerId, range],
    queryFn: () => apiGet<ModelMixEntry[]>(`/api/v1/admin/developer-timeseries/${developerId}`, { range, format: 'mix' }),
    enabled: !!developerId,
  });

  // Derive model mix from timeseries data
  const modelMixData: ModelMixEntry[] = (() => {
    const series = timeseries.data ?? [];
    const byModel: Record<string, { totalTokens: number; costUsd: number }> = {};
    for (const pt of series) {
      if (!byModel[pt.model]) byModel[pt.model] = { totalTokens: 0, costUsd: 0 };
      byModel[pt.model]!.totalTokens += pt.totalTokens;
      byModel[pt.model]!.costUsd += pt.costUsd;
    }
    const total = Object.values(byModel).reduce((s, v) => s + v.totalTokens, 0);
    return Object.entries(byModel).map(([model, v]) => ({
      model,
      totalTokens: v.totalTokens,
      costUsd: v.costUsd,
      percentage: total > 0 ? (v.totalTokens / total) * 100 : 0,
    }));
  })();

  const lastSeenStr = stats.data
    ? null  // getDashboardStats doesn't return lastSeen, we'll derive from timeseries
    : null;
  const lastSeenDisplay = timeseries.data && timeseries.data.length > 0
    ? new Date(timeseries.data[timeseries.data.length - 1]!.bucket).toLocaleDateString()
    : 'Unknown';

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div>
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors mb-3"
        >
          <ArrowLeft className="h-4 w-4" />
          Overview
        </button>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {displayName}&apos;s Usage
          </h1>
          <TimeRangeSelector value={range} onChange={setRange} />
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="Total tokens"
          value={fmt(stats.data?.tokensToday ?? 0)}
          icon={Zap}
        />
        <StatCard
          label="Total cost"
          value={`$${(stats.data?.costToday ?? 0).toFixed(2)}`}
          icon={DollarSign}
        />
        <StatCard
          label="Last seen"
          value={lastSeenDisplay}
          icon={Clock}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <TokenChart data={timeseries.data ?? []} isLoading={timeseries.isLoading} />
        </div>
        <div>
          <ModelMixChart data={modelMixData} isLoading={timeseries.isLoading} />
        </div>
      </div>

      {/* Machines */}
      {isOwner && (
        <div className="bg-white dark:bg-dark-900 rounded-lg border border-slate-200 dark:border-dark-800">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-dark-800 flex items-center gap-2">
            <Monitor className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Machines</h2>
          </div>
          {machines.isLoading ? (
            <div className="p-4 space-y-2">
              {[1, 2].map((i) => <div key={i} className="h-4 rounded bg-slate-100 dark:bg-dark-800 animate-pulse" />)}
            </div>
          ) : !machines.data?.length ? (
            <p className="p-4 text-sm text-slate-400">No machines connected yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-dark-800">
              {machines.data.map((m) => {
                const isWiping = wipingMachineId === m.apiKeyId;
                return (
                  <li key={m.apiKeyId} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{m.label}</p>
                      <p className="text-xs text-slate-400">
                        {m.entryCount > 0
                          ? `${fmt(m.totalTokens)} tokens · $${m.costUsd.toFixed(2)} · last seen ${m.lastSeen ? new Date(m.lastSeen).toLocaleDateString() : '—'}`
                          : 'No data yet'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isWiping ? (
                        <>
                          <span className="text-xs text-red-600 dark:text-red-400">Wipe this machine?</span>
                          <button
                            onClick={() => wipeMachine.mutate(m.apiKeyId)}
                            disabled={wipeMachine.isPending}
                            className="text-xs px-2 py-1 rounded bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setWipingMachineId(null)}
                            className="text-xs px-2 py-1 rounded bg-slate-200 dark:bg-dark-700 text-slate-700 dark:text-slate-300"
                          >
                            No
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setWipingMachineId(m.apiKeyId)}
                          className="p-1.5 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                          title="Wipe this machine's data"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
