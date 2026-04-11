import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { getTheme, getModelColors } from '@/lib/chart-theme';
import { ChartTooltip } from './ChartTooltip';
import { useDarkMode } from '@/lib/useDarkMode';
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
  const isDark = useDarkMode();
  const theme = getTheme(isDark);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-slate-300 dark:border-dark-600 bg-white dark:bg-dark-800 p-5 h-72">
        <div className="h-full flex items-center justify-center">
          <div className="w-full h-40 rounded bg-slate-200 dark:bg-dark-700 animate-pulse" />
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
      <div className="rounded-lg border border-slate-300 dark:border-dark-600 bg-white dark:bg-dark-800 p-5 h-72 flex items-center justify-center">
        <p className="text-slate-500 dark:text-slate-500 text-sm">No data for this time range</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-300 dark:border-dark-600 bg-white dark:bg-dark-800 p-5">
      <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-4">Daily Cost</h3>
      <ResponsiveContainer width="100%" height={210}>
        <BarChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={getModelColors(isDark).Opus} stopOpacity={0.9} />
              <stop offset="100%" stopColor={getModelColors(isDark).Sonnet} stopOpacity={0.7} />
            </linearGradient>
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
            tickFormatter={(v) => formatCost(v)}
            width={60}
          />
          <Tooltip
            content={<ChartTooltip isDark={isDark} valueFormatter={formatCost} />}
            cursor={{ fill: theme.cursor }}
          />
          <Bar
            dataKey="Cost"
            fill="url(#costGradient)"
            radius={[4, 4, 0, 0]}
            maxBarSize={40}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
