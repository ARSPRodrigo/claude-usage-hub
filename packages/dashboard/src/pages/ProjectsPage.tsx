import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { TimeRangeSelector } from '@/components/layout/TimeRangeSelector';
import { useProjects } from '@/api/hooks';
import { formatTokens, formatCost } from '@/lib/utils';
import { getDisplayName } from '@/lib/name-generator';
import { ApiError } from '@/components/ApiError';

type TimeRange = '5h' | '24h' | '7d' | '30d' | 'all';

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

export function ProjectsPage() {
  const [range, setRange] = useState<TimeRange>('7d');

  const { data, isLoading, isError, refetch } = useProjects(range);

  const totalTokens = data?.reduce((s, p) => s + p.totalTokens, 0) ?? 1;

  if (isError) {
    return (
      <div>
        <PageHeader range={range} setRange={setRange} />
        <div className="rounded-card border border-line bg-surface p-5">
          <ApiError message="Could not load projects." onRetry={() => refetch()} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader range={range} setRange={setRange} />

      {isLoading ? (
        <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-card border border-line bg-surface p-5 h-44 animate-pulse" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <div className="py-12 text-center text-ink-3 text-sm">
          No projects found for this time range
        </div>
      ) : (
        <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
          {data.map((project, i) => {
            const pct = totalTokens > 0 ? project.totalTokens / totalTokens : 0;
            return (
              <div key={project.projectAlias} className="rounded-card border border-line bg-surface overflow-hidden">
                <div className="p-5 pb-3.5">
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="min-w-0">
                      <div className="mono text-[10px] text-ink-3 mb-1.5" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                        #{String(i + 1).padStart(2, '0')} · {project.sessionCount} sessions
                      </div>
                      <div className="font-semibold text-[17px] truncate" style={{ letterSpacing: '-0.015em' }}>
                        {getDisplayName(project.projectAlias)}
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-ink-3 flex-shrink-0 mt-1" />
                  </div>
                  <div className="flex gap-6 mt-4.5">
                    <div>
                      <div className="label mb-1">Tokens</div>
                      <div className="mono tabular text-xl font-medium" style={{ letterSpacing: '-0.015em' }}>
                        {formatTokens(project.totalTokens)}
                      </div>
                    </div>
                    <div>
                      <div className="label mb-1">Cost</div>
                      <div className="mono tabular text-xl font-medium" style={{ letterSpacing: '-0.015em' }}>
                        {formatCost(project.costUsd)}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="px-5 py-3 border-t border-line-2 bg-canvas-alt">
                  <div className="flex justify-between text-[11px] mb-1.5">
                    <span className="label">Share of total</span>
                    <span className="mono tabular text-ink-2">{(pct * 100).toFixed(1)}%</span>
                  </div>
                  <HBar value={pct} max={0.4} color="var(--accent)" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PageHeader({ range, setRange }: { range: TimeRange; setRange: (r: TimeRange) => void }) {
  return (
    <div className="flex items-end justify-between mb-6 gap-5 flex-wrap">
      <div>
        <div className="label mb-2">OVERVIEW · /PROJECTS</div>
        <h1 className="text-title m-0" style={{ fontSize: 36, lineHeight: 1.05 }}>Projects</h1>
        <div className="text-ink-3 mt-2 text-sm">
          Token consumption and cost rolled up by project alias.
        </div>
      </div>
      <TimeRangeSelector value={range} onChange={setRange} />
    </div>
  );
}
