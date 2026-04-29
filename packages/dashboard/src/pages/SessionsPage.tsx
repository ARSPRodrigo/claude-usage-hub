import { useState } from 'react';
import { Search, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { TimeRangeSelector } from '@/components/layout/TimeRangeSelector';
import { SessionDetail } from '@/components/dashboard/SessionDetail';
import { useSessions } from '@/api/hooks';
import { formatDate, formatDuration, formatTokens, formatCost, modelShortName, modelBadgeStyle, formatRelative } from '@/lib/utils';
import { getDisplayName } from '@/lib/name-generator';
import { ApiError } from '@/components/ApiError';
import { downloadCsv } from '@/lib/csv-export';

type TimeRange = '5h' | '24h' | '7d' | '30d' | 'all';
type Filter = 'all' | 'active' | 'idle' | 'ended';

const PAGE_SIZE = 50;

export function SessionsPage() {
  const [range, setRange] = useState<TimeRange>('7d');
  const [offset, setOffset] = useState(0);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const { data, isLoading, isError, refetch } = useSessions(range, PAGE_SIZE, offset);

  const sessions = data?.sessions ?? [];
  const total = data?.total ?? 0;

  // Client-side search filter (the API doesn't support search)
  const filtered = sessions.filter((s) => {
    const matchesQuery = !query || getDisplayName(s.sessionId).toLowerCase().includes(query.toLowerCase()) ||
      (s.projectAlias && s.projectAlias.toLowerCase().includes(query.toLowerCase()));
    return matchesQuery;
  });

  if (isError) {
    return (
      <div>
        <PageHeader range={range} setRange={setRange} setOffset={setOffset} />
        <div className="rounded-card border border-line bg-surface p-5">
          <ApiError message="Could not load sessions." onRetry={() => refetch()} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader range={range} setRange={setRange} setOffset={setOffset} sessions={sessions} />

      {/* Search + filter pills */}
      <div className="flex gap-2.5 mb-3.5 items-center">
        <div className="flex items-center gap-2 px-3 py-[7px] border border-line rounded-btn bg-surface w-[280px]">
          <Search className="h-3.5 w-3.5 text-ink-3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search session or project…"
            className="border-none outline-none bg-transparent flex-1 text-[13px] text-ink placeholder:text-ink-3"
            style={{ fontFamily: 'inherit' }}
          />
        </div>
        <div className="flex gap-1">
          {(['all', 'active', 'idle', 'ended'] as Filter[]).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className="mono px-2.5 py-1.5 text-[10.5px] border border-line rounded-btn cursor-pointer transition-colors"
              style={{
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                background: filter === k ? 'var(--ink)' : 'var(--surface)',
                color: filter === k ? 'var(--bg)' : 'var(--ink-2)',
              }}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-card border border-line bg-surface overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-line">
              {['Session', 'Project', 'Model', 'Tokens', 'Cost', 'Started'].map((h) => (
                <th
                  key={h}
                  className="label py-3 px-4"
                  style={{ textAlign: h === 'Tokens' || h === 'Cost' ? 'right' : 'left' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-4">
                        <div className="h-4 w-16 rounded bg-line-2 animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              : filtered.map((session, i) => {
                  const isExpanded = expandedSession === session.sessionId;
                  return (
                    <tr
                      key={session.sessionId}
                      onClick={() => setExpandedSession(isExpanded ? null : session.sessionId)}
                      className="cursor-pointer hover:bg-canvas-alt transition-colors"
                      style={{ borderBottom: i === filtered.length - 1 && !isExpanded ? 'none' : '1px solid var(--line-2)' }}
                    >
                      <td className="px-4 py-3">
                        <span className="mono font-medium">{getDisplayName(session.sessionId)}</span>
                      </td>
                      <td className="px-4 py-3 text-ink-2">
                        {session.projectAlias ? getDisplayName(session.projectAlias) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5 flex-wrap">
                          {session.models.map((m) => {
                            const name = modelShortName(m);
                            return (
                              <span
                                key={m}
                                className="mono inline-flex items-center gap-1.5 px-2 py-0.5 rounded-pill border border-line bg-canvas-alt text-[11px] font-medium"
                              >
                                <span className="w-1.5 h-1.5 rounded-sm" style={{ background: modelBadgeStyle(name).color }} />
                                {name.toUpperCase()}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right mono tabular">{formatTokens(session.totalTokens)}</td>
                      <td className="px-4 py-3 text-right mono tabular">{formatCost(session.costUsd)}</td>
                      <td className="px-4 py-3 text-ink-3 text-xs">{formatRelative(session.firstSeen)}</td>
                    </tr>
                  );
                })}
          </tbody>
        </table>

        {!isLoading && filtered.length === 0 && (
          <div className="py-12 text-center text-ink-3 text-sm">
            No sessions found for this time range
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-ink-3 mt-4">
        <span>
          Showing {offset + 1}–{offset + sessions.length} of {total.toLocaleString()}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            disabled={offset === 0}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-btn border border-line hover:bg-canvas-alt disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Prev
          </button>
          <button
            onClick={() => setOffset(offset + PAGE_SIZE)}
            disabled={sessions.length < PAGE_SIZE}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-btn border border-line hover:bg-canvas-alt disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function PageHeader({ range, setRange, setOffset, sessions }: {
  range: TimeRange;
  setRange: (r: TimeRange) => void;
  setOffset: (n: number) => void;
  sessions?: { sessionId: string; firstSeen: string; lastSeen: string; models: string[]; totalTokens: number; costUsd: number }[];
}) {
  return (
    <div className="flex items-end justify-between mb-6 gap-5 flex-wrap">
      <div>
        <div className="label mb-2">OVERVIEW · /SESSIONS</div>
        <h1 className="text-title m-0" style={{ fontSize: 36, lineHeight: 1.05 }}>Sessions</h1>
        <div className="text-ink-3 mt-2 text-sm">
          {sessions ? `${sessions.length} session${sessions.length !== 1 ? 's' : ''} across your team.` : 'Loading…'}
        </div>
      </div>
      <div className="flex gap-2 items-center">
        {sessions && sessions.length > 0 && (
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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-line bg-surface rounded-btn text-[13px] font-medium text-ink cursor-pointer hover:bg-canvas-alt transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        )}
        <TimeRangeSelector value={range} onChange={(r) => { setRange(r); setOffset(0); }} />
      </div>
    </div>
  );
}
