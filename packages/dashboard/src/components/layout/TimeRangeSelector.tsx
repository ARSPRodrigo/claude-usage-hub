import { cn } from '@/lib/utils';

type TimeRange = '5h' | '24h' | '7d' | '30d' | 'all';

const ranges: { value: TimeRange; label: string }[] = [
  { value: '5h', label: '5H' },
  { value: '24h', label: '24H' },
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: 'all', label: 'ALL' },
];

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
}

export function TimeRangeSelector({ value, onChange }: TimeRangeSelectorProps) {
  return (
    <div className="inline-flex border border-line rounded-btn p-0.5 bg-surface">
      {ranges.map((r) => (
        <button
          key={r.value}
          onClick={() => onChange(r.value)}
          className={cn(
            'mono px-2.5 py-[5px] text-[11px] font-medium rounded-pill cursor-pointer transition-all duration-[120ms]',
            value === r.value
              ? 'bg-ink text-canvas'
              : 'text-ink-3 hover:text-ink-2',
          )}
          style={{ letterSpacing: '0.04em' }}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
