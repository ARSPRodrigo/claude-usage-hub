import { useState } from 'react';
import { ArrowLeft, DollarSign, Zap, Clock } from 'lucide-react';
import { TimeRangeSelector } from '@/components/layout/TimeRangeSelector';
import { TokenChart } from '@/components/dashboard/TokenChart';
import { ModelMixChart } from '@/components/dashboard/ModelMixChart';
import { useDeveloperStats, useDeveloperTimeseries } from '@/api/hooks';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/api/client';

type TimeRange = '5h' | '24h' | '7d' | '30d' | 'all';

interface ModelMixEntry {
  model: string;
  totalTokens: number;
  costUsd: number;
  percentage: number;
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
  const [range, setRange] = useState<TimeRange>('7d');

  const stats = useDeveloperStats(developerId, range);
  const timeseries = useDeveloperTimeseries(developerId, range);

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
          Org Overview
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
    </div>
  );
}
