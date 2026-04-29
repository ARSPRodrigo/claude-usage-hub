import { useState } from 'react';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { TimeRangeSelector } from '@/components/layout/TimeRangeSelector';
import { TokenChart } from '@/components/dashboard/TokenChart';
import { ModelMixChart } from '@/components/dashboard/ModelMixChart';
import { useDeveloperStats, useDeveloperTimeseries } from '@/api/hooks';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiDelete, getUser } from '@/api/client';
import { formatTokens, formatCost } from '@/lib/utils';

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

  const lastSeenDisplay = timeseries.data && timeseries.data.length > 0
    ? new Date(timeseries.data[timeseries.data.length - 1]!.bucket).toLocaleDateString()
    : 'Unknown';

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink transition-colors mb-3"
        >
          <ArrowLeft className="h-4 w-4" />
          Overview
        </button>
        <div className="flex items-center justify-between">
          <h1 className="text-title m-0" style={{ fontSize: 36, lineHeight: 1.05 }}>
            {displayName}&apos;s Usage
          </h1>
          <TimeRangeSelector value={range} onChange={setRange} />
        </div>
      </div>

      {/* Stat cards */}
      <div
        className="grid gap-0 border border-line rounded-card bg-surface overflow-hidden mb-5"
        style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}
      >
        {[
          { l: 'Total tokens', v: formatTokens(stats.data?.tokensToday ?? 0) },
          { l: 'Total cost', v: formatCost(stats.data?.costToday ?? 0) },
          { l: 'Last seen', v: lastSeenDisplay },
        ].map((s, i) => (
          <div key={i} style={{ padding: '22px', borderRight: i < 2 ? '1px solid var(--line)' : 'none' }}>
            <div className="label mb-2.5">{s.l}</div>
            <div className="mono tabular display" style={{ fontSize: 30, fontWeight: 500, letterSpacing: '-0.02em' }}>
              {s.v}
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: '1fr 320px' }}>
        <TokenChart data={timeseries.data ?? []} isLoading={timeseries.isLoading} range={range.toUpperCase()} />
        <ModelMixChart data={modelMixData} isLoading={timeseries.isLoading} />
      </div>

      {/* Machines */}
      {isOwner && (
        <div className="rounded-card border border-line bg-surface">
          <div className="px-5 py-4 border-b border-line flex items-center gap-2">
            <div className="label">Machines</div>
          </div>
          {machines.isLoading ? (
            <div className="p-5 space-y-2">
              {[1, 2].map((i) => <div key={i} className="h-4 rounded bg-line-2 animate-pulse" />)}
            </div>
          ) : !machines.data?.length ? (
            <p className="p-5 text-sm text-ink-3">No machines connected yet.</p>
          ) : (
            <div>
              {machines.data.map((m, i) => {
                const isWiping = wipingMachineId === m.apiKeyId;
                return (
                  <div
                    key={m.apiKeyId}
                    className="flex items-center justify-between px-5 py-3"
                    style={{ borderTop: i === 0 ? 'none' : '1px solid var(--line-2)' }}
                  >
                    <div>
                      <p className="font-medium text-[13.5px]">{m.label}</p>
                      <p className="text-xs text-ink-3 mt-0.5">
                        {m.entryCount > 0
                          ? `${formatTokens(m.totalTokens)} tokens · ${formatCost(m.costUsd)} · last seen ${m.lastSeen ? new Date(m.lastSeen).toLocaleDateString() : '—'}`
                          : 'No data yet'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isWiping ? (
                        <>
                          <span className="text-xs text-neg">Wipe this machine?</span>
                          <button
                            onClick={() => wipeMachine.mutate(m.apiKeyId)}
                            disabled={wipeMachine.isPending}
                            className="text-xs px-2 py-1 rounded-pill bg-neg text-white disabled:opacity-50"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setWipingMachineId(null)}
                            className="text-xs px-2 py-1 rounded-pill border border-line text-ink"
                          >
                            No
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setWipingMachineId(m.apiKeyId)}
                          className="p-1.5 text-ink-4 hover:text-neg transition-colors"
                          title="Wipe this machine's data"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
