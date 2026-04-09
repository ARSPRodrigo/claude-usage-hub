import { cn } from '@/lib/utils';

type TimeRange = '5h' | '24h' | '7d' | '30d' | 'all';

const ranges: { value: TimeRange; label: string }[] = [
  { value: '5h', label: '5h' },
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: 'all', label: 'All' },
];

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
}

export function TimeRangeSelector({ value, onChange }: TimeRangeSelectorProps) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 dark:border-dark-600 p-0.5 bg-slate-100 dark:bg-dark-900">
      {ranges.map((r) => (
        <button
          key={r.value}
          onClick={() => onChange(r.value)}
          className={cn(
            'px-3 py-1 text-xs font-medium rounded-md transition-all',
            value === r.value
              ? 'bg-white dark:bg-dark-700 text-slate-800 dark:text-cyan-400 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300',
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
