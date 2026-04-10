import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { MODEL_COLORS, getTheme, modelGradientId } from '@/lib/chart-theme';
import { ChartTooltip } from './ChartTooltip';
import { useDarkMode } from '@/lib/useDarkMode';
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

export function TokenChart({ data, isLoading }: TokenChartProps) {
  const isDark = useDarkMode();
  const theme = getTheme(isDark);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-dark-600 bg-white dark:bg-dark-800 p-5 h-80">
        <div className="h-full flex items-center justify-center">
          <div className="w-full h-48 rounded bg-slate-200 dark:bg-dark-700 animate-pulse" />
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

  const models = [...new Set(data.map((p) => modelShortName(p.model)))].sort((a, b) => {
    const order = ['Opus', 'Sonnet', 'Haiku'];
    return order.indexOf(a) - order.indexOf(b);
  });

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
      <div className="rounded-xl border border-slate-200 dark:border-dark-600 bg-white dark:bg-dark-800 p-5 h-80 flex items-center justify-center">
        <p className="text-slate-500 dark:text-slate-500 text-sm">No data for this time range</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-dark-600 bg-white dark:bg-dark-800 p-5">
      <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-4">Token Usage</h3>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
          <defs>
            {models.map((model) => {
              const color = MODEL_COLORS[model as keyof typeof MODEL_COLORS] ?? '#94a3b8';
              return (
                <linearGradient key={model} id={modelGradientId(model)} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.05} />
                </linearGradient>
              );
            })}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: theme.axis, fontSize: 11 }}
            axisLine={{ stroke: theme.grid }}
            tickLine={false}
            dy={8}
          />
          <YAxis
            tick={{ fill: theme.axis, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => formatTokens(v)}
            width={55}
          />
          <Tooltip
            content={<ChartTooltip isDark={isDark} valueFormatter={formatTokens} />}
            cursor={{ stroke: theme.cursor, strokeWidth: 1 }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: '12px', color: theme.axis, paddingTop: '12px' }}
          />
          {models.map((model) => {
            const color = MODEL_COLORS[model as keyof typeof MODEL_COLORS] ?? '#94a3b8';
            return (
              <Area
                key={model}
                type="monotone"
                dataKey={model}
                stackId="1"
                stroke={color}
                strokeWidth={2}
                fill={`url(#${modelGradientId(model)})`}
              />
            );
          })}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
