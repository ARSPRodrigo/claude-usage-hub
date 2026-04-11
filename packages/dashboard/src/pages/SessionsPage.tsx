import { useState } from 'react';
import { TimeRangeSelector } from '@/components/layout/TimeRangeSelector';
import { SessionDetail } from '@/components/dashboard/SessionDetail';
import { useSessions } from '@/api/hooks';
import { formatDate, formatDuration, formatTokens, formatCost, modelShortName, modelBadgeStyle } from '@/lib/utils';
import { getDisplayName } from '@/lib/name-generator';
import { useDarkMode } from '@/lib/useDarkMode';
import { ApiError } from '@/components/ApiError';
import { downloadCsv } from '@/lib/csv-export';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Download } from 'lucide-react';

type TimeRange = '5h' | '24h' | '7d' | '30d' | 'all';

const PAGE_SIZE = 50;

export function SessionsPage() {
  const isDark = useDarkMode();
  const [range, setRange] = useState<TimeRange>('7d');
  const [offset, setOffset] = useState(0);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useSessions(range, PAGE_SIZE, offset);

  const sessions = data?.sessions ?? [];
  const total = data?.total ?? 0;

  if (isError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200">Sessions</h2>
          <TimeRangeSelector value={range} onChange={(r) => { setRange(r); setOffset(0); }} />
        </div>
        <div className="rounded-lg border border-slate-300 dark:border-dark-600 bg-white dark:bg-dark-800 p-5">
          <ApiError message="Could not load sessions." onRetry={() => refetch()} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200">Sessions</h2>
        <div className="flex items-center gap-2">
          {sessions.length > 0 && (
            <button
              onClick={() => {
                downloadCsv(
                  `sessions-${range}.csv`,
                  ['Session', 'Start', 'End', 'Duration', 'Models', 'Tokens', 'Cost'],
                  sessions.map((s) => [
                    getDisplayName(s.sessionId),
                    s.firstSeen,
                    s.lastSeen,
                    formatDuration(s.firstSeen, s.lastSeen),
                    s.models.map((m) => modelShortName(m)).join(', '),
                    String(s.totalTokens),
                    s.costUsd.toFixed(4),
                  ]),
                );
              }}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-dark-700 text-slate-400 dark:text-slate-500 transition-colors"
              title="Export CSV"
            >
              <Download className="h-4 w-4" />
            </button>
          )}
          <TimeRangeSelector
            value={range}
            onChange={(r) => {
              setRange(r);
              setOffset(0);
              setExpandedSession(null);
            }}
          />
        </div>
      </div>

      <div className="rounded-lg border border-slate-300 dark:border-dark-600 bg-white dark:bg-dark-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-dark-600">
              <th className="w-8 px-3 py-3"></th>
              <th className="text-left px-3 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Session</th>
              <th className="text-left px-3 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Start</th>
              <th className="text-left px-3 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Duration</th>
              <th className="text-left px-3 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Models</th>
              <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tokens</th>
              <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cost</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-dark-600/50">
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-4 w-16 rounded bg-slate-200 dark:bg-dark-700 animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              : sessions.map((session) => {
                  const isExpanded = expandedSession === session.sessionId;
                  return (
                    <>
                      <tr
                        key={session.sessionId}
                        onClick={() => setExpandedSession(isExpanded ? null : session.sessionId)}
                        className="hover:bg-slate-50 dark:hover:bg-dark-700 transition-colors cursor-pointer"
                      >
                        <td className="px-3 py-4 text-slate-400 dark:text-slate-500">
                          {isExpanded
                            ? <ChevronUp className="h-3.5 w-3.5" />
                            : <ChevronDown className="h-3.5 w-3.5" />}
                        </td>
                        <td className="px-3 py-4 text-slate-700 dark:text-slate-300">
                          <span className="text-sm">{getDisplayName(session.sessionId)}</span>
                        </td>
                        <td className="px-3 py-4 text-slate-600 dark:text-slate-400">
                          {formatDate(session.firstSeen)}
                        </td>
                        <td className="px-3 py-4 text-slate-600 dark:text-slate-400">
                          {formatDuration(session.firstSeen, session.lastSeen)}
                        </td>
                        <td className="px-3 py-4">
                          <div className="flex gap-1.5 flex-wrap">
                            {session.models.map((m) => {
                              const name = modelShortName(m);
                              return (
                                <span
                                  key={m}
                                  className="px-2 py-0.5 text-xs font-medium rounded-md"
                                  style={modelBadgeStyle(name, isDark)}
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
                      {isExpanded && (
                        <tr key={`${session.sessionId}-detail`}>
                          <td colSpan={7} className="p-0">
                            <SessionDetail sessionId={session.sessionId} />
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
          </tbody>
        </table>

        {!isLoading && sessions.length === 0 && (
          <div className="py-12 text-center text-slate-500 dark:text-slate-500 text-sm">
            No sessions found for this time range
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
        <span>
          Showing {offset + 1}–{offset + sessions.length} of {total.toLocaleString()}
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
            disabled={sessions.length < PAGE_SIZE}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-dark-600 hover:bg-slate-100 dark:hover:bg-dark-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
