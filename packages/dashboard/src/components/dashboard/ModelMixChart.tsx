import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { MODEL_COLORS, getTheme } from '@/lib/chart-theme';
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

const MODEL_DOT_CLASSES: Record<string, string> = {
  Opus: 'bg-cyan-400',
  Sonnet: 'bg-purple-500',
  Haiku: 'bg-fuchsia-500',
};

export function ModelMixChart({ data, isLoading }: ModelMixChartProps) {
  const isDark = useDarkMode();
  const theme = getTheme(isDark);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-dark-600 bg-white dark:bg-dark-800 p-5 h-full">
        <div className="flex items-center justify-center h-48">
          <div className="w-32 h-32 rounded-full bg-slate-200 dark:bg-dark-700 animate-pulse" />
        </div>
      </div>
    );
  }

  const chartData = data.map((d) => ({
    name: modelShortName(d.model),
    tokens: d.totalTokens,
    percentage: d.percentage,
    color: MODEL_COLORS[modelShortName(d.model) as keyof typeof MODEL_COLORS] ?? '#94a3b8',
  }));

  if (chartData.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-dark-600 bg-white dark:bg-dark-800 p-5 flex items-center justify-center h-full">
        <p className="text-slate-500 dark:text-slate-500 text-sm">No data</p>
      </div>
    );
  }

  const totalTokens = chartData.reduce((sum, d) => sum + d.tokens, 0);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-dark-600 bg-white dark:bg-dark-800 p-5">
      <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-4">Model Mix</h3>

      <div className="relative">
        <ResponsiveContainer width="100%" height={180}>
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
      <div className="mt-3 space-y-2">
        {chartData.map((d) => (
          <div key={d.name} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${MODEL_DOT_CLASSES[d.name] ?? 'bg-slate-500'}`} />
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
