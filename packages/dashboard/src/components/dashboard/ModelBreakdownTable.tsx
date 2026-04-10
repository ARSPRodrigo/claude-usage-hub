import { formatTokens, formatCost, modelShortName, modelBadgeClasses } from '@/lib/utils';

interface ModelRow {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  costUsd: number;
  entryCount: number;
}

interface ModelBreakdownTableProps {
  data: ModelRow[];
  isLoading: boolean;
}

export function ModelBreakdownTable({ data, isLoading }: ModelBreakdownTableProps) {
  if (isLoading) {
    return (
      <div className="px-5 py-4">
        <div className="h-16 rounded bg-slate-200 dark:bg-dark-700 animate-pulse" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="px-5 py-4 text-sm text-slate-500">No detail available</div>
    );
  }

  return (
    <div className="px-5 py-4 bg-slate-50 dark:bg-dark-900/50">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-slate-500 dark:text-slate-500">
            <th className="text-left py-1.5 font-medium">Model</th>
            <th className="text-right py-1.5 font-medium">Input</th>
            <th className="text-right py-1.5 font-medium">Output</th>
            <th className="text-right py-1.5 font-medium">Cache Write</th>
            <th className="text-right py-1.5 font-medium">Cache Read</th>
            <th className="text-right py-1.5 font-medium">Cost</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-dark-600/30">
          {data.map((row) => {
            const name = modelShortName(row.model);
            return (
              <tr key={row.model}>
                <td className="py-2">
                  <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${modelBadgeClasses(name)}`}>
                    {name}
                  </span>
                </td>
                <td className="py-2 text-right text-slate-700 dark:text-slate-300">
                  {formatTokens(row.inputTokens)}
                </td>
                <td className="py-2 text-right text-slate-700 dark:text-slate-300">
                  {formatTokens(row.outputTokens)}
                </td>
                <td className="py-2 text-right text-slate-700 dark:text-slate-300">
                  {formatTokens(row.cacheCreationTokens)}
                </td>
                <td className="py-2 text-right text-slate-700 dark:text-slate-300">
                  {formatTokens(row.cacheReadTokens)}
                </td>
                <td className="py-2 text-right text-slate-600 dark:text-slate-400 font-medium">
                  {formatCost(row.costUsd)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
