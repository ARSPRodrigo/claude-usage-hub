import { AreaChart } from '@tremor/react';
import { modelShortName, formatTokens } from '@/lib/utils';

interface TimeseriesPoint {
  bucket: string;
  model: string;
  totalTokens: number;
}

interface TokenChartProps {
  data: TimeseriesPoint[];
  isLoading: boolean;
}

const MODEL_COLORS: Record<string, string> = {
  Opus: '#8b5cf6',
  Sonnet: '#3b82f6',
  Haiku: '#10b981',
};

export function TokenChart({ data, isLoading }: TokenChartProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-5 h-80">
        <div className="h-full flex items-center justify-center">
          <div className="w-full h-48 rounded bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
        </div>
      </div>
    );
  }

  // Pivot: group by bucket, spread models as columns
  const bucketMap = new Map<string, Record<string, number>>();
  for (const point of data) {
    const shortName = modelShortName(point.model);
    const existing = bucketMap.get(point.bucket) ?? {};
    existing[shortName] = (existing[shortName] ?? 0) + point.totalTokens;
    bucketMap.set(point.bucket, existing);
  }

  const models = [...new Set(data.map((p) => modelShortName(p.model)))];
  const chartData = Array.from(bucketMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bucket, values]) => ({
      date: new Date(bucket).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      ...values,
    }));

  if (chartData.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-5 h-80 flex items-center justify-center">
        <p className="text-zinc-400 dark:text-zinc-500 text-sm">No data for this time range</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-5">
      <h3 className="text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-4">Token Usage</h3>
      <AreaChart
        className="h-64"
        data={chartData}
        index="date"
        categories={models}
        colors={models.map((m) => {
          const hex = MODEL_COLORS[m];
          if (hex === '#8b5cf6') return 'violet';
          if (hex === '#3b82f6') return 'blue';
          if (hex === '#10b981') return 'emerald';
          return 'zinc';
        })}
        valueFormatter={(v) => formatTokens(v)}
        showLegend={true}
        showAnimation={true}
        stack={true}
        curveType="monotone"
      />
    </div>
  );
}
