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
  OpenAI:    '#10a37f',  // GPT green
  Google:    '#4285f4',  // Google blue
  xAI:       '#8b5cf6',  // neutral purple
  DeepSeek:  '#4D6BFE',  // DeepSeek blue
  Mistral:   '#FF8205',  // Mistral orange
};

function getProviderColor(provider: string): string {
  return PROVIDER_COLORS[provider] ?? '#888';
}

interface ComparisonEntry {
  modelId: string;
  displayName: string;
  provider: string;
  tier: 'opus' | 'sonnet';
  inputCost: number;
  outputCost: number;
  cacheCost: number;
  totalCost: number;
}

function TierSection({
  title,
  subtitle,
  anthropicLabel,
  anthropicCost,
  models,
  actualCost,
}: {
  title: string;
  subtitle: string;
  anthropicLabel: string;
  anthropicCost: number;
  models: ComparisonEntry[];
  actualCost: number;
}) {
  if (models.length === 0) return null;
  const cheapest = models[0];
  const theme = getTheme();

  return (
    <div className="rounded-card border border-line bg-surface mb-5">
      {/* Header with Anthropic baseline */}
      <div className="px-5 py-4 border-b border-line-2">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="label">{title}</div>
            <div className="text-[15.5px] font-medium mt-1.5" style={{ letterSpacing: '-0.01em' }}>
              {subtitle}
            </div>
          </div>
          <div className="text-right">
            <div className="label">Your cost ({anthropicLabel})</div>
            <div className="mono tabular text-[22px] font-medium mt-1" style={{ letterSpacing: '-0.02em' }}>
              {formatCost(anthropicCost)}
            </div>
          </div>
        </div>
      </div>

      {/* Horizontal bar chart */}
      <div className="p-4" style={{ height: models.length * 44 + 40 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={models} layout="vertical" margin={{ top: 4, right: 20, left: 4, bottom: 4 }}>
            <CartesianGrid stroke={theme.grid} strokeDasharray="2 3" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fill: theme.axis, fontSize: 10, fontFamily: '"JetBrains Mono"' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => formatCost(v)}
            />
            <YAxis
              type="category"
              dataKey="displayName"
              width={140}
              tick={{ fill: theme.axis, fontSize: 11, fontFamily: '"JetBrains Mono"' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as ComparisonEntry;
                const pct = anthropicCost > 0 ? ((d.totalCost / anthropicCost) * 100).toFixed(0) : '—';
                return (
                  <div className="bg-surface border border-line rounded-card shadow-tooltip p-2.5 text-xs">
                    <div className="font-medium mb-1.5">{d.displayName} <span className="text-ink-3">({d.provider})</span></div>
                    <div className="flex justify-between gap-6 mono tabular"><span className="text-ink-3">Input</span><span>{formatCost(d.inputCost)}</span></div>
                    <div className="flex justify-between gap-6 mono tabular"><span className="text-ink-3">Output</span><span>{formatCost(d.outputCost)}</span></div>
                    <div className="flex justify-between gap-6 mono tabular"><span className="text-ink-3">Cache</span><span>{formatCost(d.cacheCost)}</span></div>
                    <div className="flex justify-between gap-6 mono tabular font-medium border-t border-line-2 mt-1.5 pt-1.5">
                      <span>Total</span><span>{formatCost(d.totalCost)}</span>
                    </div>
                    <div className="text-ink-3 mt-1">{pct}% of your {anthropicLabel} cost</div>
                  </div>
                );
              }}
              cursor={{ fill: 'var(--line-2)' }}
            />
            <Bar dataKey="totalCost" radius={[0, 3, 3, 0]} maxBarSize={24}>
              {models.map((entry) => (
                <Cell key={entry.modelId} fill={getProviderColor(entry.provider)} fillOpacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="border-t border-line-2">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-line">
              {['#', 'Provider', 'Model', 'Input', 'Output', 'Cache', 'Total', 'vs Claude'].map((h) => (
                <th
                  key={h}
                  className="label py-2.5 px-4"
                  style={{ textAlign: ['Input', 'Output', 'Cache', 'Total', 'vs Claude'].includes(h) ? 'right' : 'left' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {models.map((c, i) => {
              const pct = anthropicCost > 0 ? (c.totalCost / anthropicCost) * 100 : 0;
              return (
                <tr
                  key={c.modelId}
                  style={{ borderBottom: i === models.length - 1 ? 'none' : '1px solid var(--line-2)' }}
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
                    {anthropicCost > 0 && (
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

      {/* Provider legend */}
      <div className="px-5 py-3 border-t border-line-2 flex gap-4 flex-wrap">
        {[...new Set(models.map((m) => m.provider))].map((provider) => (
          <div key={provider} className="flex items-center gap-1.5 text-xs">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: getProviderColor(provider) }} />
            <span className="text-ink-2">{provider}</span>
          </div>
        ))}
      </div>
    </div>
  );
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

  const opus = data?.opus;
  const sonnet = data?.sonnet;

  const opusModels = (opus?.comparisons ?? []) as ComparisonEntry[];
  const sonnetModels = (sonnet?.comparisons ?? []) as ComparisonEntry[];

  const opusCost = opus?.actualCost ?? 0;
  const sonnetCost = sonnet?.actualCost ?? 0;
  const totalActualCost = opusCost + sonnetCost;

  return (
    <div>
      <PageHeader range={range} setRange={setRange} />

      {/* Cost summary strip */}
      <div
        className="grid gap-0 border border-line rounded-card bg-surface overflow-hidden mb-5"
        style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}
      >
        {[
          { label: 'Opus Usage Cost', value: formatCost(opusCost) },
          { label: 'Sonnet / Haiku Usage Cost', value: formatCost(sonnetCost) },
          { label: 'Total Actual Cost', value: formatCost(totalActualCost), highlight: true },
        ].map((s, i) => (
          <div
            key={i}
            style={{
              padding: '18px 20px',
              borderRight: i < 2 ? '1px solid var(--line)' : 'none',
              background: s.highlight ? 'color-mix(in oklch, var(--accent) 6%, transparent)' : undefined,
            }}
          >
            <div className="label mb-2">{s.label}</div>
            <div className="mono tabular" style={{ fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em' }}>
              {isLoading ? <span className="inline-block w-16 h-6 rounded bg-line-2 animate-pulse" /> : s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Opus tier */}
      <TierSection
        title="OPUS-CLASS · FLAGSHIP REASONING"
        subtitle="Comparable to Claude Opus 4.6 / 4.7"
        anthropicLabel="Opus"
        anthropicCost={opusCost}
        models={opusModels}
        actualCost={opusCost}
      />

      {/* Sonnet tier */}
      <TierSection
        title="SONNET-CLASS · DAILY-DRIVER CODING"
        subtitle="Comparable to Claude Sonnet 4.6"
        anthropicLabel="Sonnet"
        anthropicCost={sonnetCost}
        models={sonnetModels}
        actualCost={sonnetCost}
      />

      {!isLoading && opusModels.length === 0 && sonnetModels.length === 0 && (
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
