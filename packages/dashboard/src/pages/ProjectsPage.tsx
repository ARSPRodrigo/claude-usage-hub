import { useState } from 'react';
import { TimeRangeSelector } from '@/components/layout/TimeRangeSelector';
import { ModelBreakdownTable } from '@/components/dashboard/ModelBreakdownTable';
import { useProjects, useProjectDetail } from '@/api/hooks';
import { formatTokens, formatCost } from '@/lib/utils';
import { getDisplayName } from '@/lib/name-generator';
import { ApiError } from '@/components/ApiError';
import { downloadCsv } from '@/lib/csv-export';
import { ChevronDown, ChevronUp, Download } from 'lucide-react';

type TimeRange = '5h' | '24h' | '7d' | '30d' | 'all';

export function ProjectsPage() {
  const [range, setRange] = useState<TimeRange>('7d');
  const [expandedProject, setExpandedProject] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useProjects(range);
  const projectDetail = useProjectDetail(expandedProject, range);

  const maxTokens = data?.reduce((max, p) => Math.max(max, p.totalTokens), 0) ?? 1;

  if (isError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200">Projects</h2>
          <TimeRangeSelector value={range} onChange={setRange} />
        </div>
        <div className="rounded-lg border border-slate-300 dark:border-dark-600 bg-white dark:bg-dark-800 p-5">
          <ApiError message="Could not load projects." onRetry={() => refetch()} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200">Projects</h2>
        <div className="flex items-center gap-2">
          {data && data.length > 0 && (
            <button
              onClick={() => {
                downloadCsv(
                  `projects-${range}.csv`,
                  ['Project', 'Sessions', 'Tokens', 'Cost'],
                  data.map((p) => [
                    getDisplayName(p.projectAlias),
                    String(p.sessionCount),
                    String(p.totalTokens),
                    p.costUsd.toFixed(4),
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
              setExpandedProject(null);
            }}
          />
        </div>
      </div>

      <div className="rounded-lg border border-slate-300 dark:border-dark-600 bg-white dark:bg-dark-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-dark-600">
              <th className="w-8 px-3 py-3"></th>
              <th className="text-left px-3 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Project
              </th>
              <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Sessions
              </th>
              <th className="text-left px-3 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider min-w-[200px]">
                Tokens
              </th>
              <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Cost
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-dark-600/50">
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-4 w-20 rounded bg-slate-200 dark:bg-dark-700 animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              : data?.map((project) => {
                  const barWidth = maxTokens > 0 ? (project.totalTokens / maxTokens) * 100 : 0;
                  const isExpanded = expandedProject === project.projectAlias;
                  return (
                    <>
                      <tr
                        key={project.projectAlias}
                        onClick={() => setExpandedProject(isExpanded ? null : project.projectAlias)}
                        className="hover:bg-slate-50 dark:hover:bg-dark-700 transition-colors cursor-pointer"
                      >
                        <td className="px-3 py-4 text-slate-400 dark:text-slate-500">
                          {isExpanded
                            ? <ChevronUp className="h-3.5 w-3.5" />
                            : <ChevronDown className="h-3.5 w-3.5" />}
                        </td>
                        <td className="px-3 py-4 text-slate-700 dark:text-slate-300">
                          <span className="text-sm">{getDisplayName(project.projectAlias)}</span>
                        </td>
                        <td className="px-5 py-4 text-right text-slate-600 dark:text-slate-400">
                          {project.sessionCount}
                        </td>
                        <td className="px-3 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-2 rounded-full bg-slate-300 dark:bg-dark-700 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-cyan-500 dark:bg-cyan-400 transition-all duration-500"
                                style={{ width: `${barWidth}%` }}
                              />
                            </div>
                            <span className="text-slate-700 dark:text-slate-300 font-medium min-w-[60px] text-right">
                              {formatTokens(project.totalTokens)}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right text-slate-500 dark:text-slate-400">
                          {formatCost(project.costUsd)}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${project.projectAlias}-detail`}>
                          <td colSpan={5} className="p-0">
                            <ModelBreakdownTable
                              data={projectDetail.data ?? []}
                              isLoading={projectDetail.isLoading}
                            />
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
          </tbody>
        </table>

        {!isLoading && (!data || data.length === 0) && (
          <div className="py-12 text-center text-slate-500 dark:text-slate-500 text-sm">
            No projects found for this time range
          </div>
        )}
      </div>
    </div>
  );
}
