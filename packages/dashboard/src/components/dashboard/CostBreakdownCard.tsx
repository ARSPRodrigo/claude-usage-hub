import { formatCost } from '@/lib/utils';

interface CostBreakdownCardProps {
  data?: {
    inputCost: number;
    outputCost: number;
    cacheWriteCost: number;
    cacheReadCost: number;
    totalCost: number;
  } | null;
  isLoading: boolean;
}

function HBar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div className="h-1.5 bg-line-2 rounded-sm overflow-hidden w-full">
      <div
        className="h-full rounded-sm transition-all duration-500"
        style={{ width: `${max > 0 ? (value / max) * 100 : 0}%`, background: color }}
      />
    </div>
  );
}

export function CostBreakdownCard({ data, isLoading }: CostBreakdownCardProps) {
  if (isLoading) {
    return (
      <div className="rounded-card border border-line bg-surface p-5">
        <div className="h-40 rounded bg-line-2 animate-pulse" />
      </div>
    );
  }

  const total = data?.totalCost ?? 0;
  const rows = [
    { k: 'Input', v: data?.inputCost ?? 0, c: 'var(--m-sonnet)' },
    { k: 'Output', v: data?.outputCost ?? 0, c: 'var(--m-opus)' },
    { k: 'Cache Write', v: data?.cacheWriteCost ?? 0, c: 'var(--accent)' },
    { k: 'Cache Read', v: data?.cacheReadCost ?? 0, c: 'var(--m-haiku)' },
  ];

  return (
    <div className="rounded-card border border-line bg-surface flex flex-col">
      <div className="px-5 py-4 border-b border-line-2">
        <div className="label">03 · Cost breakdown</div>
        <div className="text-[15.5px] font-medium mt-1.5" style={{ letterSpacing: '-0.01em' }}>
          By category
        </div>
      </div>
      <div className="px-5 py-5">
        {rows.map((row, i) => (
          <div
            key={row.k}
            className="grid items-center gap-3"
            style={{
              gridTemplateColumns: '110px 1fr 80px',
              padding: '10px 0',
              borderTop: i === 0 ? 'none' : '1px solid var(--line-2)',
            }}
          >
            <div className="text-[13px] font-medium">{row.k}</div>
            <HBar value={row.v} max={total} color={row.c} />
            <div className="mono tabular text-right text-[13px] font-medium">
              {formatCost(row.v)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
