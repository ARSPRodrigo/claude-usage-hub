import type { TooltipProps } from 'recharts';
import { formatTokens } from '@/lib/utils';

interface ChartTooltipProps extends TooltipProps<number, string> {
  isDark?: boolean;
  valueFormatter?: (value: number) => string;
}

export function ChartTooltip({ active, payload, label, valueFormatter }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  const format = valueFormatter ?? ((v: number) => v.toLocaleString());
  const total = payload.reduce((sum, entry) => sum + ((entry.value as number) ?? 0), 0);

  return (
    <div
      className="bg-surface border border-line rounded-card shadow-tooltip pointer-events-none"
      style={{ padding: '8px 10px', fontSize: '12px', minWidth: 160 }}
    >
      <div
        className="mono text-ink-3 mb-1.5"
        style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}
      >
        {label}
      </div>
      {payload.map((entry, i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-3"
          style={{ lineHeight: '18px' }}
        >
          <span className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-sm flex-shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-ink-2">{entry.name}</span>
          </span>
          <span className="mono tabular font-medium text-ink">
            {format(entry.value as number)}
          </span>
        </div>
      ))}
      {payload.length > 1 && (
        <div
          className="mt-1.5 pt-1.5 border-t border-line-2 flex justify-between text-[11px] text-ink-2"
        >
          <span>Total</span>
          <span className="mono tabular font-semibold">{formatTokens(total)}</span>
        </div>
      )}
    </div>
  );
}
