import { useState } from 'react';
import { TimeRangeSelector } from '@/components/layout/TimeRangeSelector';
import { useProjects } from '@/api/hooks';
import { formatTokens, formatCost } from '@/lib/utils';
import { getDisplayName } from '@/lib/name-generator';

type TimeRange = '5h' | '24h' | '7d' | '30d' | 'all';

export function ProjectsPage() {
  const [range, setRange] = useState<TimeRange>('7d');

  const { data, isLoading } = useProjects(range);

  const maxTokens = data?.reduce((max, p) => Math.max(max, p.totalTokens), 0) ?? 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200">Projects</h2>
        <TimeRangeSelector value={range} onChange={setRange} />
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-dark-600 bg-white dark:bg-dark-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-dark-600">
              <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Project
              </th>
              <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Sessions
              </th>
              <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider min-w-[200px]">
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
                    {Array.from({ length: 4 }).map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-4 w-20 rounded bg-slate-200 dark:bg-dark-700 animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              : data?.map((project) => {
                  const barWidth = maxTokens > 0 ? (project.totalTokens / maxTokens) * 100 : 0;
                  return (
                    <tr
                      key={project.projectAlias}
                      className="hover:bg-slate-50 dark:hover:bg-dark-700 transition-colors"
                    >
                      <td className="px-5 py-4 text-slate-700 dark:text-slate-300">
                        <span className="text-sm">{getDisplayName(project.projectAlias)}</span>
                      </td>
                      <td className="px-5 py-4 text-right text-slate-600 dark:text-slate-400">
                        {project.sessionCount}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 rounded-full bg-slate-200 dark:bg-dark-700 overflow-hidden">
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
                  );
                })}
          </tbody>
        </table>

        {!isLoading && (!data || data.length === 0) && (
          <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-sm">
            No projects found for this time range
          </div>
        )}
      </div>
    </div>
  );
}
