import { useState } from 'react';
import { TimeRangeSelector } from '@/components/layout/TimeRangeSelector';
import { StatCards } from '@/components/dashboard/StatCards';
import { TokenChart } from '@/components/dashboard/TokenChart';
import { CostChart } from '@/components/dashboard/CostChart';
import { ModelMixChart } from '@/components/dashboard/ModelMixChart';
import { useDashboardStats, useTokenTimeseries, useCostTrend, useModelMix } from '@/api/hooks';

type TimeRange = '5h' | '24h' | '7d' | '30d';

export function DashboardPage() {
  const [range, setRange] = useState<TimeRange>('7d');

  const stats = useDashboardStats(range);
  const timeseries = useTokenTimeseries(range);
  const costTrend = useCostTrend(range);
  const modelMix = useModelMix(range);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-200">Dashboard</h2>
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
