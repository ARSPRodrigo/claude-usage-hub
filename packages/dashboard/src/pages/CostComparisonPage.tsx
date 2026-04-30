import { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { TimeRangeSelector } from '@/components/layout/TimeRangeSelector';
import { ApiError } from '@/components/ApiError';
import { useCostComparison } from '@/api/hooks';
import { formatTokens, formatCost } from '@/lib/utils';
import { getTheme } from '@/lib/chart-theme';

type TimeRange = '5h' | '24h' | '7d' | '30d' | 'all';

const PROVIDER_COLORS: Record<string, string> = {
  OpenAI:    '#4a9a6a',
  Google:    '#b89a30',
  xAI:       '#7a5aad',
  DeepSeek:  '#c06a3a',
  Mistral:   '#c08a30',
};

function getProviderColor(provider: string): string {
  return PROVIDER_COLORS[provider] ?? '#888';
}

export function CostComparisonPage() {
  const [range, setRange] = useState<TimeRange>('7d');
  const { data, isLoading, isError, refetch } = useCostComparison(range);

  if (isError) {
    return (
      <div>
        <PageHeader range={range} setRange={setRange} />
        <div className="rounded-card border border-line bg-surface p-5">
          <ApiError message="Could not load cost comparison data." onRetry={() => refetch()} />
        </div>
      </div>
    );
  }

  const comparisons = data?.comparisons ?? [];
  const tokens = data?.tokens;
  const actualCost = data?.actualCost ?? 0;
  const cheapest = comparisons[0];
  const maxCost = comparisons.length > 0 ? comparisons[comparisons.length - 1].totalCost : 1;

  return (
    <div>
      <PageHeader range={range} setRange={setRange} />

      {/* Token summary strip */}
      {tokens && (
        <div
          className="grid gap-0 border border-line rounded-card bg-surface overflow-hidden mb-5"
          style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}
        >
          {[
            { label: 'Input Tokens', value: formatTokens(tokens.inputTokens) },
            { label: 'Output Tokens', value: formatTokens(tokens.outputTokens) },
            { label: 'Cache Write', value: formatTokens(tokens.cacheCreationTokens) },
            { label: 'Cache Read', value: formatTokens(tokens.cacheReadTokens) },
          ].map((s, i) => (
            <div key={i} style={{ padding: '18px 20px', borderRight: i < 3 ? '1px solid var(--line)' : 'none' }}>
              <div className="label mb-2">{s.label}</div>
              <div className="mono tabular text-stat">{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Savings callout */}
      {cheapest && actualCost > 0 && (
        <div className="rounded-card border border-line bg-surface p-5 mb-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="label mb-1.5">Your actual cost ({range.toUpperCase()})</div>
              <div className="mono tabular text-[28px] font-medium" style={{ letterSpacing: '-0.02em' }}>
                {formatCost(actualCost)}
              </div>
            </div>
            <div className="text-right">
              <div className="label mb-1.5">Cheapest alternative</div>
              <div className="mono tabular text-[28px] font-medium" style={{ letterSpacing: '-0.02em', color: 'var(--pos)' }}>
                {formatCost(cheapest.totalCost)}
              </div>
              <div className="text-xs text-ink-3 mt-1">
                {cheapest.displayName} ({cheapest.provider})
                {actualCost > 0 && (
                  <span className="mono ml-1.5" style={{ color: 'var(--pos)' }}>
                    {((1 - cheapest.totalCost / actualCost) * 100).toFixed(0)}% less
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Horizontal bar chart */}
      {comparisons.length > 0 && (
        <div className="rounded-card border border-line bg-surface mb-5">
          <div className="px-5 py-4 border-b border-line-2">
            <div className="label">Cost by model</div>
            <div className="text-[15.5px] font-medium mt-1.5" style={{ letterSpacing: '-0.01em' }}>
              Sorted cheapest to most expensive
            </div>
          </div>
          <div className="p-4" style={{ height: Math.max(400, comparisons.length * 36 + 40) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisons} layout="vertical" margin={{ top: 4, right: 20, left: 4, bottom: 4 }}>
                <CartesianGrid
                  stroke={getTheme().grid}
                  strokeDasharray="2 3"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tick={{ fill: getTheme().axis, fontSize: 10, fontFamily: '"JetBrains Mono"' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => formatCost(v)}
                />
                <YAxis
                  type="category"
                  dataKey="displayName"
                  width={150}
                  tick={{ fill: getTheme().axis, fontSize: 11, fontFamily: '"JetBrains Mono"' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload as typeof comparisons[0];
                    return (
                      <div className="bg-surface border border-line rounded-card shadow-tooltip p-2.5 text-xs">
                        <div className="font-medium mb-1">{d.displayName} <span className="text-ink-3">({d.provider})</span></div>
                        <div className="flex justify-between gap-4 mono tabular">
                          <span className="text-ink-3">Input</span>
                          <span>{formatCost(d.inputCost)}</span>
                        </div>
                        <div className="flex justify-between gap-4 mono tabular">
                          <span className="text-ink-3">Output</span>
                          <span>{formatCost(d.outputCost)}</span>
                        </div>
                        <div className="flex justify-between gap-4 mono tabular">
                          <span className="text-ink-3">Cache</span>
                          <span>{formatCost(d.cacheCost)}</span>
                        </div>
                        <div className="flex justify-between gap-4 mono tabular font-medium border-t border-line-2 mt-1 pt-1">
                          <span>Total</span>
                          <span>{formatCost(d.totalCost)}</span>
                        </div>
                      </div>
                    );
                  }}
                  cursor={{ fill: 'var(--line-2)' }}
                />
                <Bar dataKey="totalCost" radius={[0, 3, 3, 0]} maxBarSize={24}>
                  {comparisons.map((entry) => (
                    <Cell
                      key={entry.modelId}
                      fill={getProviderColor(entry.provider)}
                      fillOpacity={entry.isAnthropic ? 1 : 0.7}
                      stroke={entry.isAnthropic ? 'var(--ink)' : 'none'}
                      strokeWidth={entry.isAnthropic ? 1.5 : 0}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Provider legend */}
          <div className="px-5 pb-4 flex gap-4 flex-wrap">
            {Object.entries(PROVIDER_COLORS).map(([provider, color]) => (
              <div key={provider} className="flex items-center gap-1.5 text-xs">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
                <span className="text-ink-2">{provider}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detailed table */}
      {comparisons.length > 0 && (
        <div className="rounded-card border border-line bg-surface overflow-hidden">
          <div className="px-5 py-4 border-b border-line-2">
            <div className="label">Detailed breakdown</div>
            <div className="text-[15.5px] font-medium mt-1.5" style={{ letterSpacing: '-0.01em' }}>
              All models ranked by total cost
            </div>
          </div>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line">
                {['#', 'Provider', 'Model', 'Input', 'Output', 'Cache', 'Total', 'vs Actual'].map((h) => (
                  <th
                    key={h}
                    className="label py-2.5 px-4"
                    style={{ textAlign: ['Input', 'Output', 'Cache', 'Total', 'vs Actual'].includes(h) ? 'right' : 'left' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparisons.map((c, i) => {
                const pct = actualCost > 0 ? ((c.totalCost / actualCost) * 100) : 0;
                const isHighlighted = c.isAnthropic;
                return (
                  <tr
                    key={c.modelId}
                    style={{
                      borderBottom: i === comparisons.length - 1 ? 'none' : '1px solid var(--line-2)',
                      background: isHighlighted ? 'color-mix(in oklch, var(--accent) 6%, transparent)' : undefined,
                    }}
                  >
                    <td className="mono text-ink-4 text-[11px] px-4 py-3">{String(i + 1).padStart(2, '0')}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-sm" style={{ background: getProviderColor(c.provider) }} />
                        <span className="text-ink-2">{c.provider}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium">{c.displayName}</td>
                    <td className="px-4 py-3 text-right mono tabular">{formatCost(c.inputCost)}</td>
                    <td className="px-4 py-3 text-right mono tabular">{formatCost(c.outputCost)}</td>
                    <td className="px-4 py-3 text-right mono tabular">{formatCost(c.cacheCost)}</td>
                    <td className="px-4 py-3 text-right mono tabular font-medium">{formatCost(c.totalCost)}</td>
                    <td className="px-4 py-3 text-right mono tabular text-xs">
                      {actualCost > 0 && (
                        <span style={{ color: pct <= 100 ? 'var(--pos)' : 'var(--neg)' }}>
                          {pct.toFixed(0)}%
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!isLoading && comparisons.length === 0 && (
        <div className="rounded-card border border-line bg-surface p-12 text-center text-ink-3 text-sm">
          No usage data for this time range
        </div>
      )}
    </div>
  );
}

function PageHeader({ range, setRange }: { range: TimeRange; setRange: (r: TimeRange) => void }) {
  return (
    <div className="flex items-end justify-between mb-6 gap-5 flex-wrap">
      <div>
        <div className="label mb-2">ANALYTICS · /COST-COMPARISON</div>
        <h1 className="text-title m-0" style={{ fontSize: 36, lineHeight: 1.05 }}>
          Cost comparison
        </h1>
        <div className="text-ink-3 mt-2 text-sm">
          What your actual token usage would cost on other LLM APIs.
        </div>
        <div className="mono text-ink-4 mt-1" style={{ fontSize: '10.5px', letterSpacing: '0.04em' }}>
          PRICING UPDATED 30 APR 2026
        </div>
      </div>
      <TimeRangeSelector value={range} onChange={setRange} />
    </div>
  );
}
