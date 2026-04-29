import { ArrowRight } from 'lucide-react';
import { formatTokens, formatCost } from '@/lib/utils';
import { getDisplayName } from '@/lib/name-generator';

interface ProjectRow {
  projectAlias: string;
  sessionCount: number;
  totalTokens: number;
  costUsd: number;
}

interface TopProjectsCardProps {
  data?: ProjectRow[] | null;
  isLoading: boolean;
  onSeeAll?: () => void;
}

function HBar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div className="h-1.5 bg-line-2 rounded-sm overflow-hidden w-full">
      <div
        className="h-full rounded-sm"
        style={{ width: `${max > 0 ? (value / max) * 100 : 0}%`, background: color }}
      />
    </div>
  );
}

export function TopProjectsCard({ data, isLoading, onSeeAll }: TopProjectsCardProps) {
  if (isLoading) {
    return (
      <div className="rounded-card border border-line bg-surface p-5">
        <div className="h-40 rounded bg-line-2 animate-pulse" />
      </div>
    );
  }

  const projects = (data ?? []).slice(0, 5);
  const maxTokens = projects.reduce((max, p) => Math.max(max, p.totalTokens), 1);

  return (
    <div className="rounded-card border border-line bg-surface flex flex-col">
      <div className="px-5 py-4 border-b border-line-2 flex items-center justify-between">
        <div>
          <div className="label">04 · Top projects</div>
          <div className="text-[15.5px] font-medium mt-1.5" style={{ letterSpacing: '-0.01em' }}>
            Leaderboard
          </div>
        </div>
        {onSeeAll && (
          <button
            onClick={onSeeAll}
            className="text-xs text-ink-3 flex items-center gap-1 cursor-pointer hover:text-ink-2 transition-colors"
          >
            See all <ArrowRight className="h-3 w-3" />
          </button>
        )}
      </div>
      <div>
        {projects.map((p, i) => (
          <div
            key={p.projectAlias}
            className="grid items-center gap-3.5 px-5"
            style={{
              gridTemplateColumns: '24px 1fr 80px 60px',
              padding: '12px 20px',
              borderTop: i === 0 ? 'none' : '1px solid var(--line-2)',
            }}
          >
            <div className="mono text-ink-4 text-[11px]">
              {String(i + 1).padStart(2, '0')}
            </div>
            <div>
              <div className="font-medium text-[13.5px]">{getDisplayName(p.projectAlias)}</div>
              <div className="mono text-[10.5px] text-ink-3 mt-0.5" style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                {formatTokens(p.totalTokens)} TOKENS · {p.sessionCount} SESSIONS
              </div>
            </div>
            <HBar value={p.totalTokens} max={maxTokens} color="var(--ink)" />
            <div className="mono tabular text-right text-[13px] font-medium">
              {formatCost(p.costUsd)}
            </div>
          </div>
        ))}
        {projects.length === 0 && (
          <div className="px-5 py-8 text-center text-ink-3 text-sm">No projects yet</div>
        )}
      </div>
    </div>
  );
}
