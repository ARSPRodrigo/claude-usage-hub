import { useState } from 'react';
import { Download } from 'lucide-react';
import { TimeRangeSelector } from '@/components/layout/TimeRangeSelector';
import { StatCards } from '@/components/dashboard/StatCards';
import { TokenChart } from '@/components/dashboard/TokenChart';
import { ModelMixChart } from '@/components/dashboard/ModelMixChart';
import { CostBreakdownCard } from '@/components/dashboard/CostBreakdownCard';
import { TopProjectsCard } from '@/components/dashboard/TopProjectsCard';
import { ApiError } from '@/components/ApiError';
import { WelcomeCard } from '@/components/dashboard/WelcomeCard';
import { useDashboardStats, useTokenTimeseries, useCostBreakdown, useModelMix, useHealth, useProjects } from '@/api/hooks';

type TimeRange = '5h' | '24h' | '7d' | '30d' | 'all';

export function DashboardPage() {
  const [range, setRange] = useState<TimeRange>('7d');

  const health = useHealth();
  const stats = useDashboardStats(range);
  const timeseries = useTokenTimeseries(range);
  const costBreakdown = useCostBreakdown(range);
  const modelMix = useModelMix(range);
  const projects = useProjects(range);

  const hasError = stats.isError || timeseries.isError || modelMix.isError;
  const isEmpty = health.data?.entryCount === 0;

  if (isEmpty) {
    return <WelcomeCard />;
  }

  if (hasError) {
    return (
      <div>
        <PageHeader range={range} setRange={setRange} />
        <div className="rounded-card border border-line bg-surface p-5">
          <ApiError
            message="Could not load dashboard data. Is the server running?"
            onRetry={() => {
              stats.refetch();
              timeseries.refetch();
              modelMix.refetch();
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader range={range} setRange={setRange} />

      {/* Stats strip */}
      <StatCards
        tokensToday={stats.data?.tokensToday ?? 0}
        costToday={stats.data?.costToday ?? 0}
        activeSessions={stats.data?.activeSessions ?? 0}
        totalSessions={stats.data?.totalSessions ?? 0}
        costBreakdown={costBreakdown.data}
        isLoading={stats.isLoading}
      />

      {/* Token chart + Model mix */}
      <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: '1fr 320px' }}>
        <TokenChart data={timeseries.data ?? []} isLoading={timeseries.isLoading} range={range.toUpperCase()} />
        <ModelMixChart data={modelMix.data ?? []} isLoading={modelMix.isLoading} />
      </div>

      {/* Cost breakdown + Top projects */}
      <div className="grid grid-cols-2 gap-4">
        <CostBreakdownCard data={costBreakdown.data} isLoading={costBreakdown.isLoading} />
        <TopProjectsCard data={projects.data} isLoading={projects.isLoading} />
      </div>
    </div>
  );
}

function PageHeader({ range, setRange }: { range: TimeRange; setRange: (r: TimeRange) => void }) {
  return (
    <div className="flex items-end justify-between mb-6 gap-5 flex-wrap">
      <div>
        <div className="label mb-2">OVERVIEW · /</div>
        <h1
          className="text-title m-0"
          style={{ fontSize: 36, lineHeight: 1.05 }}
        >
          Dashboard
        </h1>
        <div className="text-ink-3 mt-2 text-sm">
          Your team&apos;s token consumption across all projects and models.
        </div>
      </div>
      <div className="flex gap-2 items-center">
        <TimeRangeSelector value={range} onChange={setRange} />
        <button className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-line bg-surface rounded-btn text-[13px] font-medium text-ink cursor-pointer hover:bg-canvas-alt transition-colors">
          <Download className="h-3.5 w-3.5" />
          Export
        </button>
      </div>
    </div>
  );
}
