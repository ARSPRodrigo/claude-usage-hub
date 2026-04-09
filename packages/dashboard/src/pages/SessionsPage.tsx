import { useState } from 'react';
import { TimeRangeSelector } from '@/components/layout/TimeRangeSelector';
import { useSessions } from '@/api/hooks';
import { truncateId, formatDate, formatDuration, formatTokens, formatCost, modelShortName } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type TimeRange = '5h' | '24h' | '7d' | '30d';

const PAGE_SIZE = 50;

export function SessionsPage() {
  const [range, setRange] = useState<TimeRange>('7d');
  const [offset, setOffset] = useState(0);

  const { data, isLoading } = useSessions(range, PAGE_SIZE, offset);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-200">Sessions</h2>
        <TimeRangeSelector
          value={range}
          onChange={(r) => {
            setRange(r);
            setOffset(0);
          }}
        />
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <th className="text-left px-5 py-3 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Session</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Start</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Duration</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Models</th>
              <th className="text-right px-5 py-3 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Tokens</th>
              <th className="text-right px-5 py-3 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Cost</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-4 w-20 rounded bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              : data?.map((session) => (
                  <tr
                    key={session.sessionId}
                    className="hover:bg-zinc-100/50 dark:hover:bg-zinc-800/30 transition-colors"
                  >
                    <td className="px-5 py-4 font-mono text-zinc-700 dark:text-zinc-300">
                      {truncateId(session.sessionId)}
                    </td>
                    <td className="px-5 py-4 text-zinc-600 dark:text-zinc-400">
                      {formatDate(session.firstSeen)}
                    </td>
                    <td className="px-5 py-4 text-zinc-600 dark:text-zinc-400">
                      {formatDuration(session.firstSeen, session.lastSeen)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-1.5 flex-wrap">
                        {session.models.map((m) => {
                          const name = modelShortName(m);
                          const colorClass =
                            name === 'Opus'
                              ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400'
                              : name === 'Sonnet'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
                          return (
                            <span
                              key={m}
                              className={`px-2 py-0.5 text-xs font-medium rounded-md ${colorClass}`}
                            >
                              {name}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right text-zinc-700 dark:text-zinc-300 font-medium">
                      {formatTokens(session.totalTokens)}
                    </td>
                    <td className="px-5 py-4 text-right text-zinc-500 dark:text-zinc-400">
                      {formatCost(session.costUsd)}
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>

        {!isLoading && (!data || data.length === 0) && (
          <div className="py-12 text-center text-zinc-400 dark:text-zinc-500 text-sm">
            No sessions found for this time range
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-400">
        <span>
          Showing {offset + 1}–{offset + (data?.length ?? 0)}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            disabled={offset === 0}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Prev
          </button>
          <button
            onClick={() => setOffset(offset + PAGE_SIZE)}
            disabled={!data || data.length < PAGE_SIZE}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
