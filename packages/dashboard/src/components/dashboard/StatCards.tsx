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

function Skeleton() {
  return <span className="inline-block w-20 h-8 rounded bg-line-2 animate-pulse" />;
}

export function StatCards({
  tokensToday,
  costToday,
  activeSessions,
  totalSessions,
  isLoading,
}: StatCardsProps) {
  const stats = [
    {
      label: 'Total Tokens',
      value: formatTokens(tokensToday),
      delta: '+12.4%',
      positive: true,
      large: true,
      mono: true,
    },
    {
      label: 'Est. Cost',
      value: formatCost(costToday),
      delta: '+8.1%',
      positive: true,
      large: false,
      mono: true,
    },
    {
      label: 'Active Now',
      value: String(activeSessions),
      delta: 'LIVE',
      positive: null,
      large: false,
      mono: false,
    },
    {
      label: 'Sessions',
      value: String(totalSessions),
      delta: `${totalSessions} total`,
      positive: true,
      large: false,
      mono: false,
    },
  ];

  return (
    <div
      className="grid gap-0 border border-line rounded-card bg-surface overflow-hidden mb-5"
      style={{ gridTemplateColumns: '1.4fr 1fr 1fr 1fr' }}
    >
      {stats.map((s, i) => (
        <div
          key={i}
          className="relative min-w-0"
          style={{
            padding: '22px 22px 20px',
            borderRight: i < 3 ? '1px solid var(--line)' : 'none',
          }}
        >
          <div className="label mb-3">{s.label}</div>
          {isLoading ? (
            <Skeleton />
          ) : (
            <div
              className={`tabular ${s.mono ? 'mono' : ''}`}
              style={{
                fontSize: s.large ? 44 : 30,
                fontWeight: 500,
                letterSpacing: s.large ? '-0.035em' : '-0.02em',
                lineHeight: 1,
              }}
            >
              {s.value}
            </div>
          )}
          <div className="flex items-center gap-2.5 mt-3.5 text-[11.5px]">
            {s.delta === 'LIVE' ? (
              <span className="mono flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-pos" />
                LIVE
              </span>
            ) : (
              <span
                className="mono"
                style={{
                  color: s.positive ? 'var(--pos)' : 'var(--neg)',
                  letterSpacing: '0.03em',
                }}
              >
                {s.positive ? '▲' : '▼'} {s.delta}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
