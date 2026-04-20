import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { getModelColors, getTheme } from '@/lib/chart-theme';
import { useDarkMode } from '@/lib/useDarkMode';
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

export function ModelMixChart({ data, isLoading }: ModelMixChartProps) {
  const isDark = useDarkMode();
  const theme = getTheme(isDark);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-slate-300 dark:border-dark-600 bg-white dark:bg-dark-800 p-5 h-80 flex items-center justify-center">
        <div className="w-32 h-32 rounded-full bg-slate-200 dark:bg-dark-700 animate-pulse" />
      </div>
    );
  }

  const aggregated = new Map<string, { tokens: number; percentage: number; color: string }>();
  for (const d of data) {
    const name = modelShortName(d.model);
    const color = getModelColors(isDark)[name as keyof ReturnType<typeof getModelColors>] ?? '#94a3b8';
    const existing = aggregated.get(name);
    if (existing) {
      existing.tokens += d.totalTokens;
      existing.percentage += d.percentage;
    } else {
      aggregated.set(name, { tokens: d.totalTokens, percentage: d.percentage, color });
    }
  }
  const chartData = Array.from(aggregated.entries()).map(([name, v]) => ({ name, ...v }));

  if (chartData.length === 0) {
    return (
      <div className="rounded-lg border border-slate-300 dark:border-dark-600 bg-white dark:bg-dark-800 p-5 h-80 flex items-center justify-center">
        <p className="text-slate-500 dark:text-slate-500 text-sm">No data</p>
      </div>
    );
  }

  const totalTokens = chartData.reduce((sum, d) => sum + d.tokens, 0);

  return (
    <div className="rounded-lg border border-slate-300 dark:border-dark-600 bg-white dark:bg-dark-800 p-5 h-80 flex flex-col">
      <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-3">Model Mix</h3>

      <div className="relative flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="tokens"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={2}
              stroke="none"
            >
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => formatTokens(value)}
              contentStyle={{
                backgroundColor: theme.tooltipBg,
                border: `1px solid ${theme.tooltipBorder}`,
                borderRadius: '8px',
                color: theme.tooltipText,
                fontSize: '13px',
              }}
              itemStyle={{ color: theme.tooltipText }}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Center label */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center" style={{ marginTop: '-4px' }}>
            <p className="text-lg font-semibold text-slate-800 dark:text-slate-200">
              {formatTokens(totalTokens)}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">total</p>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-2 space-y-2">
        {chartData.map((d) => (
          <div key={d.name} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
              <span className="text-slate-600 dark:text-slate-400">{d.name}</span>
            </div>
            <span className="text-slate-800 dark:text-slate-200 font-medium">
              {d.percentage.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
