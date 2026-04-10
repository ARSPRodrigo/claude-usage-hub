import { useState } from 'react';
import { TimeRangeSelector } from '@/components/layout/TimeRangeSelector';
import { useSessions } from '@/api/hooks';
import { formatDate, formatDuration, formatTokens, formatCost, modelShortName, modelBadgeClasses } from '@/lib/utils';
import { getDisplayName } from '@/lib/name-generator';
import { ApiError } from '@/components/ApiError';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type TimeRange = '5h' | '24h' | '7d' | '30d' | 'all';

const PAGE_SIZE = 50;

export function SessionsPage() {
  const [range, setRange] = useState<TimeRange>('7d');
  const [offset, setOffset] = useState(0);

  const { data, isLoading, isError, refetch } = useSessions(range, PAGE_SIZE, offset);

  if (isError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200">Sessions</h2>
          <TimeRangeSelector value={range} onChange={(r) => { setRange(r); setOffset(0); }} />
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-dark-600 bg-white dark:bg-dark-800 p-5">
          <ApiError message="Could not load sessions." onRetry={() => refetch()} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200">Sessions</h2>
        <TimeRangeSelector
          value={range}
          onChange={(r) => {
            setRange(r);
            setOffset(0);
          }}
        />
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-dark-600 bg-white dark:bg-dark-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-dark-600">
              <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Session</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Start</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Duration</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Models</th>
              <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tokens</th>
              <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cost</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-dark-600/50">
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-4 w-20 rounded bg-slate-200 dark:bg-dark-700 animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              : data?.map((session) => (
                  <tr
                    key={session.sessionId}
                    className="hover:bg-slate-50 dark:hover:bg-dark-700 transition-colors"
                  >
                    <td className="px-5 py-4 text-slate-700 dark:text-slate-300">
                      <span className="text-sm">{getDisplayName(session.sessionId)}</span>
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-400">
                      {formatDate(session.firstSeen)}
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-400">
                      {formatDuration(session.firstSeen, session.lastSeen)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-1.5 flex-wrap">
                        {session.models.map((m) => {
                          const name = modelShortName(m);
                          return (
                            <span
                              key={m}
                              className={`px-2 py-0.5 text-xs font-medium rounded-md ${modelBadgeClasses(name)}`}
                            >
                              {name}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right text-slate-700 dark:text-slate-300 font-medium">
                      {formatTokens(session.totalTokens)}
                    </td>
                    <td className="px-5 py-4 text-right text-slate-500 dark:text-slate-400">
                      {formatCost(session.costUsd)}
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>

        {!isLoading && (!data || data.length === 0) && (
          <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-sm">
            No sessions found for this time range
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
        <span>
          Showing {offset + 1}–{offset + (data?.length ?? 0)}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            disabled={offset === 0}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-dark-600 hover:bg-slate-100 dark:hover:bg-dark-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Prev
          </button>
          <button
            onClick={() => setOffset(offset + PAGE_SIZE)}
            disabled={!data || data.length < PAGE_SIZE}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-dark-600 hover:bg-slate-100 dark:hover:bg-dark-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
