import { formatTokens, formatCost, modelShortName, modelBadgeStyle } from '@/lib/utils';

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
        <div className="h-16 rounded bg-line-2 animate-pulse" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="px-5 py-4 text-sm text-ink-3">No detail available</div>
    );
  }

  return (
    <div className="px-5 py-4 bg-canvas-alt">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-ink-3">
            <th className="text-left py-1.5 font-medium">Model</th>
            <th className="text-right py-1.5 font-medium">Input</th>
            <th className="text-right py-1.5 font-medium">Output</th>
            <th className="text-right py-1.5 font-medium">Cache Write</th>
            <th className="text-right py-1.5 font-medium">Cache Read</th>
            <th className="text-right py-1.5 font-medium">Cost</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => {
            const name = modelShortName(row.model);
            return (
              <tr key={row.model} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--line-2)' }}>
                <td className="py-2">
                  <span className="px-1.5 py-0.5 text-xs font-medium rounded-pill" style={modelBadgeStyle(name)}>
                    {name}
                  </span>
                </td>
                <td className="py-2 text-right tabular">{formatTokens(row.inputTokens)}</td>
                <td className="py-2 text-right tabular">{formatTokens(row.outputTokens)}</td>
                <td className="py-2 text-right tabular">{formatTokens(row.cacheCreationTokens)}</td>
                <td className="py-2 text-right tabular">{formatTokens(row.cacheReadTokens)}</td>
                <td className="py-2 text-right tabular font-medium text-ink-2">{formatCost(row.costUsd)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
