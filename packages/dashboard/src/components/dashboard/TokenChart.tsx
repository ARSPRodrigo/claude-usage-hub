import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { getModelColors, getTheme, modelGradientId } from '@/lib/chart-theme';
import { ChartTooltip } from './ChartTooltip';
import { modelShortName, formatTokens } from '@/lib/utils';

interface TimeseriesPoint {
  bucket: string;
  model: string;
  totalTokens: number;
}

interface TokenChartProps {
  data: TimeseriesPoint[];
  isLoading: boolean;
  range?: string;
}

export function TokenChart({ data, isLoading, range = '7D' }: TokenChartProps) {
  const theme = getTheme();

  if (isLoading) {
    return (
      <div className="rounded-card border border-line bg-surface h-[360px] flex items-center justify-center">
        <div className="w-full h-48 mx-5 rounded bg-line-2 animate-pulse" />
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
      }),
      ...values,
    }));

  if (chartData.length === 0) {
    return (
      <div className="rounded-card border border-line bg-surface h-[360px] flex items-center justify-center">
        <p className="text-ink-3 text-sm">No data for this time range</p>
      </div>
    );
  }

  const modelColors = getModelColors();

  // Compute totals per model for legend
  const totals: Record<string, number> = {};
  for (const m of models) {
    totals[m] = chartData.reduce((sum, d) => sum + ((d as unknown as Record<string, number>)[m] ?? 0), 0);
  }

  return (
    <div className="rounded-card border border-line bg-surface flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-line-2">
        <div>
          <div className="label">01 · Token usage over time</div>
          <div className="text-[15.5px] font-medium mt-1.5" style={{ letterSpacing: '-0.01em' }}>
            Stacked by model · {range}
          </div>
        </div>
        <div className="flex gap-3.5 text-xs">
          {models.map((m) => (
            <div key={m} className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-sm"
                style={{ background: modelColors[m] }}
              />
              <span className="text-ink-2">{m}</span>
              <span className="mono tabular text-ink-3 text-[11px]">
                {formatTokens(totals[m] ?? 0)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="p-2.5" style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              {models.map((model) => {
                const color = modelColors[model] ?? '#94a3b8';
                return (
                  <linearGradient key={model} id={modelGradientId(model)} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                  </linearGradient>
                );
              })}
            </defs>
            <CartesianGrid
              stroke={theme.grid}
              strokeDasharray="2 3"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tick={{ fill: theme.axis, fontSize: 10, fontFamily: '"JetBrains Mono"' }}
              axisLine={false}
              tickLine={false}
              dy={8}
            />
            <YAxis
              tick={{ fill: theme.axis, fontSize: 10, fontFamily: '"JetBrains Mono"' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => formatTokens(v)}
              width={44}
            />
            <Tooltip
              content={<ChartTooltip valueFormatter={formatTokens} />}
              cursor={{ stroke: theme.axis, strokeWidth: 1, strokeDasharray: '2 3' }}
            />
            {models.map((model) => {
              const color = modelColors[model] ?? '#94a3b8';
              return (
                <Area
                  key={model}
                  type="monotone"
                  dataKey={model}
                  stackId="1"
                  stroke={color}
                  strokeWidth={1.5}
                  fill={`url(#${modelGradientId(model)})`}
                />
              );
            })}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
