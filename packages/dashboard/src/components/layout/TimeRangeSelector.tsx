import { cn } from '@/lib/utils';

type TimeRange = '5h' | '24h' | '7d' | '30d';

const ranges: { value: TimeRange; label: string }[] = [
  { value: '5h', label: '5h' },
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
];

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
}

export function TimeRangeSelector({ value, onChange }: TimeRangeSelectorProps) {
  return (
    <div className="inline-flex rounded-lg border border-zinc-200 dark:border-zinc-700 p-0.5 bg-zinc-100 dark:bg-zinc-800">
      {ranges.map((r) => (
        <button
          key={r.value}
          onClick={() => onChange(r.value)}
          className={cn(
            'px-3 py-1 text-xs font-medium rounded-md transition-all',
            value === r.value
              ? 'bg-zinc-50 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 shadow-sm'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300',
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
