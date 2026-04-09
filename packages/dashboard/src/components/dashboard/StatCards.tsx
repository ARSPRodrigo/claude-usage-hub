import { Coins, Hash, Radio, Layers } from 'lucide-react';
import { formatTokens, formatCost } from '@/lib/utils';

interface StatCardsProps {
  tokensToday: number;
  costToday: number;
  activeSessions: number;
  totalSessions: number;
  isLoading: boolean;
}

function StatCard({
  label,
  value,
  icon: Icon,
  isLoading,
}: {
  label: string;
  value: string;
  icon: typeof Coins;
  isLoading: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-dark-600 bg-white dark:bg-dark-800 p-5">
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
    </div>
  );
}

export function StatCards({ tokensToday, costToday, activeSessions, totalSessions, isLoading }: StatCardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard label="Total Tokens" value={formatTokens(tokensToday)} icon={Hash} isLoading={isLoading} />
      <StatCard label="Est. Cost" value={formatCost(costToday)} icon={Coins} isLoading={isLoading} />
      <StatCard label="Active Now" value={String(activeSessions)} icon={Radio} isLoading={isLoading} />
      <StatCard label="Sessions" value={String(totalSessions)} icon={Layers} isLoading={isLoading} />
    </div>
  );
}
