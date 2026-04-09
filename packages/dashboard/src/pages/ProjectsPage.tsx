import { useState } from 'react';
import { TimeRangeSelector } from '@/components/layout/TimeRangeSelector';
import { useProjects } from '@/api/hooks';
import { formatTokens, formatCost } from '@/lib/utils';

type TimeRange = '5h' | '24h' | '7d' | '30d';

export function ProjectsPage() {
  const [range, setRange] = useState<TimeRange>('7d');

  const { data, isLoading } = useProjects(range);

  const maxTokens = data?.reduce((max, p) => Math.max(max, p.totalTokens), 0) ?? 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-200">Projects</h2>
        <TimeRangeSelector value={range} onChange={setRange} />
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <th className="text-left px-5 py-3 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Project
              </th>
              <th className="text-right px-5 py-3 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Sessions
              </th>
              <th className="text-left px-5 py-3 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider min-w-[200px]">
                Tokens
              </th>
              <th className="text-right px-5 py-3 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Cost
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 4 }).map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-4 w-20 rounded bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              : data?.map((project) => {
                  const barWidth = maxTokens > 0 ? (project.totalTokens / maxTokens) * 100 : 0;
                  return (
                    <tr
                      key={project.projectAlias}
                      className="hover:bg-zinc-100/50 dark:hover:bg-zinc-800/30 transition-colors"
                    >
                      <td className="px-5 py-4 font-mono text-zinc-700 dark:text-zinc-300">
                        {project.projectAlias}
                      </td>
                      <td className="px-5 py-4 text-right text-zinc-600 dark:text-zinc-400">
                        {project.sessionCount}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-indigo-500 dark:bg-indigo-400 transition-all duration-500"
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                          <span className="text-zinc-700 dark:text-zinc-300 font-medium min-w-[60px] text-right">
                            {formatTokens(project.totalTokens)}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right text-zinc-500 dark:text-zinc-400">
                        {formatCost(project.costUsd)}
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>

        {!isLoading && (!data || data.length === 0) && (
          <div className="py-12 text-center text-zinc-400 dark:text-zinc-500 text-sm">
            No projects found for this time range
          </div>
        )}
      </div>
    </div>
  );
}
