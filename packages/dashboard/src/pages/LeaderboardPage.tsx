import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet, getUser } from '@/api/client';
import { TimeRangeSelector } from '@/components/layout/TimeRangeSelector';
import { formatTokens, formatCost, formatRelative } from '@/lib/utils';

type TimeRange = '5h' | '24h' | '7d' | '30d' | 'all';

interface DeveloperStat {
  developerId: string;
  email: string;
  displayName: string;
  role?: string;
  totalTokens: number;
  costUsd: number;
  sessionCount: number;
  entryCount: number;
  lastSeen: string | null;
}

const MEDAL_COLORS = [
  'oklch(0.78 0.14 85)',   // gold
  'oklch(0.68 0.03 240)',  // silver
  'oklch(0.65 0.09 45)',   // bronze
];

function HBar({ value, max }: { value: number; max: number }) {
  return (
    <div className="bg-line-2 rounded-sm overflow-hidden w-full" style={{ height: 4 }}>
      <div
        className="h-full rounded-sm"
        style={{ width: `${max > 0 ? (value / max) * 100 : 0}%`, background: 'var(--ink)' }}
      />
    </div>
  );
}

export function LeaderboardPage() {
  const [range, setRange] = useState<TimeRange>('7d');
  const currentUser = getUser();

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['leaderboard', range],
    queryFn: () => apiGet<DeveloperStat[]>('/api/v1/dashboard/leaderboard', { range }),
    refetchInterval: 60_000,
  });

  const totalTokens = members.reduce((s, d) => s + d.totalTokens, 0);
  const totalCost = members.reduce((s, d) => s + d.costUsd, 0);
  const maxTokens = Math.max(...members.map((d) => d.totalTokens), 1);

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between mb-6 gap-5 flex-wrap">
        <div>
          <div className="label mb-2">MY TEAM</div>
          <h1 className="text-title m-0" style={{ fontSize: 36, lineHeight: 1.05 }}>Leaderboard</h1>
          <div className="text-ink-3 mt-2 text-sm">Who's using Claude the most on your team.</div>
        </div>
        <TimeRangeSelector value={range} onChange={setRange} />
      </div>

      {/* Stats strip */}
      <div
        className="grid gap-0 border border-line rounded-card bg-surface overflow-hidden mb-5"
        style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}
      >
        {[
          { l: 'Members', v: String(members.length) },
          { l: `Tokens · ${range.toUpperCase()}`, v: formatTokens(totalTokens) },
          { l: `Cost · ${range.toUpperCase()}`, v: formatCost(totalCost) },
        ].map((s, i) => (
          <div key={i} style={{ padding: '22px', borderRight: i < 2 ? '1px solid var(--line)' : 'none' }}>
            <div className="label mb-2.5">{s.l}</div>
            <div className="mono tabular display" style={{ fontSize: 32, fontWeight: 500, letterSpacing: '-0.025em' }}>
              {s.v}
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-card border border-line bg-surface overflow-hidden">
        <div className="px-5 py-4 border-b border-line">
          <div className="label">Ranking · {range === 'all' ? 'all time' : `last ${range.toUpperCase()}`}</div>
          <div className="text-[15.5px] font-medium mt-1.5">Ranked by token consumption</div>
        </div>

        {isLoading ? (
          <div className="p-8 flex justify-center">
            <div className="w-48 h-4 rounded bg-line-2 animate-pulse" />
          </div>
        ) : members.length === 0 ? (
          <p className="p-5 text-sm text-ink-3">No usage data for this time range yet.</p>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line">
                {['#', 'Member', 'Tokens', 'Share', 'Cost', 'Sessions', 'Last active'].map((h, i) => (
                  <th
                    key={h}
                    className="label py-2.5 px-4"
                    style={{ textAlign: i >= 2 && i < 6 ? 'right' : 'left' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((d, i) => {
                const isCurrentUser = d.developerId === currentUser?.developerId;
                const pct = totalTokens > 0 ? (d.totalTokens / totalTokens) * 100 : 0;
                const medalColor = MEDAL_COLORS[i];

                return (
                  <tr
                    key={d.developerId}
                    style={{
                      borderBottom: i === members.length - 1 ? 'none' : '1px solid var(--line-2)',
                      background: isCurrentUser ? 'color-mix(in oklch, var(--accent) 6%, transparent)' : undefined,
                    }}
                  >
                    {/* Rank */}
                    <td className="px-4 py-3.5">
                      {medalColor ? (
                        <div
                          className="w-6 h-6 rounded-full grid place-items-center text-[11px] font-bold text-white flex-shrink-0"
                          style={{ background: medalColor }}
                        >
                          {i + 1}
                        </div>
                      ) : (
                        <span className="mono text-ink-4 text-[11px]">{String(i + 1).padStart(2, '0')}</span>
                      )}
                    </td>

                    {/* Member */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-7 h-7 rounded-full flex-shrink-0 text-white grid place-items-center text-[11px] font-semibold"
                          style={{ background: `oklch(0.7 0.12 ${(i * 55) % 360})` }}
                        >
                          {d.displayName.split(' ').map((n) => n[0]).join('')}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium">{d.displayName}</span>
                            {isCurrentUser && (
                              <span className="mono text-[9.5px] px-1.5 py-0.5 rounded-pill bg-ink text-canvas" style={{ letterSpacing: '0.05em' }}>
                                YOU
                              </span>
                            )}
                          </div>
                          <div className="mono text-[10.5px] text-ink-3 mt-px">{d.email}</div>
                        </div>
                      </div>
                    </td>

                    {/* Tokens */}
                    <td className="px-4 py-3.5 text-right mono tabular">{formatTokens(d.totalTokens)}</td>

                    {/* Share bar */}
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <div className="w-[60px]">
                          <HBar value={d.totalTokens} max={maxTokens} />
                        </div>
                        <span className="mono tabular text-xs text-ink-2 min-w-[38px] text-right">
                          {pct.toFixed(1)}%
                        </span>
                      </div>
                    </td>

                    {/* Cost */}
                    <td className="px-4 py-3.5 text-right mono tabular">{formatCost(d.costUsd)}</td>

                    {/* Sessions */}
                    <td className="px-4 py-3.5 text-right mono tabular">{d.sessionCount ?? d.entryCount}</td>

                    {/* Last active */}
                    <td className="px-4 py-3.5 text-ink-3 text-xs">
                      {d.lastSeen ? formatRelative(d.lastSeen) : 'Never'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
