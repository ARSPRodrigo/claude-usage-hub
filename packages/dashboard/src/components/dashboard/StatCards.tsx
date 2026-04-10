import { Coins, Hash, Radio, Layers } from 'lucide-react';
import { formatTokens, formatCost } from '@/lib/utils';

interface StatCardsProps {
  tokensToday: number;
  costToday: number;
  activeSessions: number;
  totalSessions: number;
  costBreakdown?: {
    inputCost: number;
    outputCost: number;
    cacheWriteCost: number;
    cacheReadCost: number;
    totalCost: number;
  } | null;
  isLoading: boolean;
}

function StatCard({
  label,
  value,
  icon: Icon,
  isLoading,
  children,
}: {
  label: string;
  value: string;
  icon: typeof Coins;
  isLoading: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-300 dark:border-dark-600 bg-white dark:bg-dark-800 p-5">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-slate-100 dark:bg-dark-700">
          <Icon className="h-4 w-4 text-slate-500 dark:text-cyan-400/70" />
        </div>
        <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
      </div>
      <p className="mt-3 text-2xl font-semibold text-slate-800 dark:text-slate-200">
        {isLoading ? (
          <span className="inline-block w-20 h-7 rounded bg-slate-200 dark:bg-dark-700 animate-pulse" />
        ) : (
          value
        )}
      </p>
      {children}
    </div>
  );
}

interface BreakdownItem {
  label: string;
  value: number;
  color: string;
}

function CostBreakdownBar({ breakdown }: { breakdown: StatCardsProps['costBreakdown'] }) {
  if (!breakdown || breakdown.totalCost === 0) return null;

  const items: BreakdownItem[] = [
    { label: 'Input', value: breakdown.inputCost, color: 'bg-cyan-400' },
    { label: 'Output', value: breakdown.outputCost, color: 'bg-purple-500' },
    { label: 'Cache Write', value: breakdown.cacheWriteCost, color: 'bg-fuchsia-500' },
    { label: 'Cache Read', value: breakdown.cacheReadCost, color: 'bg-cyan-600' },
  ].filter((i) => i.value > 0);

  const total = breakdown.totalCost;

  return (
    <div className="mt-3" title={items.map((i) => `${i.label}: ${formatCost(i.value)}`).join(' · ')}>
      <div className="flex h-1.5 rounded-full overflow-hidden bg-slate-100 dark:bg-dark-700">
        {items.map((item) => (
          <div
            key={item.label}
            className={`${item.color} transition-all duration-500`}
            style={{ width: `${(item.value / total) * 100}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export function StatCards({
  tokensToday,
  costToday,
  activeSessions,
  totalSessions,
  costBreakdown,
  isLoading,
}: StatCardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard label="Total Tokens" value={formatTokens(tokensToday)} icon={Hash} isLoading={isLoading} />
      <StatCard label="Est. Cost" value={formatCost(costToday)} icon={Coins} isLoading={isLoading}>
        <CostBreakdownBar breakdown={costBreakdown} />
      </StatCard>
      <StatCard label="Active Now" value={String(activeSessions)} icon={Radio} isLoading={isLoading} />
      <StatCard label="Sessions" value={String(totalSessions)} icon={Layers} isLoading={isLoading} />
    </div>
  );
}
