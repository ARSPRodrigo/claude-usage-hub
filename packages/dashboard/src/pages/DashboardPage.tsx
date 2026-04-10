import { useState } from 'react';
import { TimeRangeSelector } from '@/components/layout/TimeRangeSelector';
import { StatCards } from '@/components/dashboard/StatCards';
import { TokenChart } from '@/components/dashboard/TokenChart';
import { CostChart } from '@/components/dashboard/CostChart';
import { ModelMixChart } from '@/components/dashboard/ModelMixChart';
import { ApiError } from '@/components/ApiError';
import { useDashboardStats, useTokenTimeseries, useCostTrend, useModelMix } from '@/api/hooks';

type TimeRange = '5h' | '24h' | '7d' | '30d' | 'all';

export function DashboardPage() {
  const [range, setRange] = useState<TimeRange>('7d');

  const stats = useDashboardStats(range);
  const timeseries = useTokenTimeseries(range);
  const costTrend = useCostTrend(range);
  const modelMix = useModelMix(range);

  const hasError = stats.isError || timeseries.isError || costTrend.isError || modelMix.isError;

  if (hasError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200">Dashboard</h2>
          <TimeRangeSelector value={range} onChange={setRange} />
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-dark-600 bg-white dark:bg-dark-800 p-5">
          <ApiError
            message="Could not load dashboard data. Is the server running?"
            onRetry={() => {
              stats.refetch();
              timeseries.refetch();
              costTrend.refetch();
              modelMix.refetch();
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200">Dashboard</h2>
        <TimeRangeSelector value={range} onChange={setRange} />
      </div>

      <StatCards
        tokensToday={stats.data?.tokensToday ?? 0}
        costToday={stats.data?.costToday ?? 0}
        activeSessions={stats.data?.activeSessions ?? 0}
        totalSessions={stats.data?.totalSessions ?? 0}
        isLoading={stats.isLoading}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <TokenChart data={timeseries.data ?? []} isLoading={timeseries.isLoading} />
        </div>
        <div>
          <ModelMixChart data={modelMix.data ?? []} isLoading={modelMix.isLoading} />
        </div>
      </div>

      <CostChart data={costTrend.data ?? []} isLoading={costTrend.isLoading} />
    </div>
  );
}
