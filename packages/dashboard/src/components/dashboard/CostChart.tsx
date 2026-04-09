import { BarChart } from '@tremor/react';
import { formatCost } from '@/lib/utils';

interface CostTrendPoint {
  date: string;
  costUsd: number;
}

interface CostChartProps {
  data: CostTrendPoint[];
  isLoading: boolean;
}

export function CostChart({ data, isLoading }: CostChartProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-5 h-72">
        <div className="h-full flex items-center justify-center">
          <div className="w-full h-40 rounded bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
        </div>
      </div>
    );
  }

  const chartData = data.map((d) => ({
    date: new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
    Cost: d.costUsd,
  }));

  if (chartData.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-5 h-72 flex items-center justify-center">
        <p className="text-zinc-400 dark:text-zinc-500 text-sm">No data for this time range</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-5">
      <h3 className="text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-4">Daily Cost</h3>
      <BarChart
        className="h-52"
        data={chartData}
        index="date"
        categories={['Cost']}
        colors={['indigo']}
        valueFormatter={(v) => formatCost(v)}
        showLegend={false}
        showAnimation={true}
      />
    </div>
  );
}
