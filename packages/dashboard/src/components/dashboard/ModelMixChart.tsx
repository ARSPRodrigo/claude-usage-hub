import { DonutChart } from '@tremor/react';
import { modelShortName, formatTokens } from '@/lib/utils';

interface ModelMixEntry {
  model: string;
  totalTokens: number;
  costUsd: number;
  percentage: number;
}

interface ModelMixChartProps {
  data: ModelMixEntry[];
  isLoading: boolean;
}

const MODEL_TREMOR_COLORS: Record<string, string> = {
  Opus: 'violet',
  Sonnet: 'blue',
  Haiku: 'emerald',
};

export function ModelMixChart({ data, isLoading }: ModelMixChartProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-5 h-full">
        <div className="flex items-center justify-center h-48">
          <div className="w-32 h-32 rounded-full bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
        </div>
      </div>
    );
  }

  const chartData = data.map((d) => ({
    name: modelShortName(d.model),
    tokens: d.totalTokens,
    percentage: d.percentage,
  }));

  const colors = chartData.map((d) => MODEL_TREMOR_COLORS[d.name] ?? 'zinc');

  if (chartData.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-5 flex items-center justify-center h-full">
        <p className="text-zinc-400 dark:text-zinc-500 text-sm">No data</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-5">
      <h3 className="text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-4">Model Mix</h3>
      <DonutChart
        className="h-44"
        data={chartData}
        category="tokens"
        index="name"
        colors={colors}
        valueFormatter={(v) => formatTokens(v)}
        showAnimation={true}
      />
      <div className="mt-4 space-y-2">
        {chartData.map((d) => (
          <div key={d.name} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  d.name === 'Opus'
                    ? 'bg-violet-500'
                    : d.name === 'Sonnet'
                      ? 'bg-blue-500'
                      : 'bg-emerald-500'
                }`}
              />
              <span className="text-zinc-600 dark:text-zinc-400">{d.name}</span>
            </div>
            <span className="text-zinc-800 dark:text-zinc-200 font-medium">
              {d.percentage.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
