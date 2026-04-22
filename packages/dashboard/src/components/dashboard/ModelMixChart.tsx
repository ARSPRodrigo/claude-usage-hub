import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { getModelColors } from '@/lib/chart-theme';
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

function HBar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div className="h-1.5 bg-line-2 rounded-sm overflow-hidden w-full">
      <div
        className="h-full rounded-sm"
        style={{ width: `${(value / max) * 100}%`, background: color }}
      />
    </div>
  );
}

export function ModelMixChart({ data, isLoading }: ModelMixChartProps) {
  if (isLoading) {
    return (
      <div className="rounded-card border border-line bg-surface h-full flex items-center justify-center min-h-[360px]">
        <div className="w-32 h-32 rounded-full bg-line-2 animate-pulse" />
      </div>
    );
  }

  const modelColors = getModelColors();

  const aggregated = new Map<string, { tokens: number; percentage: number; color: string }>();
  for (const d of data) {
    const name = modelShortName(d.model);
    const color = modelColors[name] ?? 'var(--ink-3)';
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
      <div className="rounded-card border border-line bg-surface h-full flex items-center justify-center min-h-[360px]">
        <p className="text-ink-3 text-sm">No data</p>
      </div>
    );
  }

  const totalTokens = chartData.reduce((sum, d) => sum + d.tokens, 0);

  return (
    <div className="rounded-card border border-line bg-surface flex flex-col">
      {/* Header */}
      <div className="px-5 py-4 border-b border-line-2">
        <div className="label">02 · Model mix</div>
        <div className="text-[15.5px] font-medium mt-1.5" style={{ letterSpacing: '-0.01em' }}>
          Distribution
        </div>
      </div>

      {/* Donut + legend */}
      <div className="px-5 py-5 flex flex-col items-center">
        <div className="relative" style={{ width: 170, height: 170 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="tokens"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={67}
                outerRadius={85}
                paddingAngle={0}
                stroke="none"
              >
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <div className="mono tabular text-[22px] font-semibold" style={{ letterSpacing: '-0.02em' }}>
                {formatTokens(totalTokens)}
              </div>
              <div className="label mt-1">TOTAL</div>
            </div>
          </div>
        </div>

        {/* Model rows */}
        <div className="w-full mt-5 flex flex-col gap-2.5">
          {chartData.map((d) => {
            const pct = (d.tokens / totalTokens) * 100;
            return (
              <div key={d.name}>
                <div className="flex items-center justify-between text-[12.5px] mb-1">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-sm" style={{ background: d.color }} />
                    <span className="font-medium">{d.name}</span>
                  </span>
                  <span className="mono tabular text-ink-2">{pct.toFixed(1)}%</span>
                </div>
                <HBar value={d.tokens} max={totalTokens} color={d.color} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
