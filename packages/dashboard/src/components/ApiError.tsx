import { WifiOff, RefreshCw } from 'lucide-react';

interface ApiErrorProps {
  message?: string;
  onRetry?: () => void;
}

export function ApiError({ message, onRetry }: ApiErrorProps) {
  return (
    <div className="flex flex-col items-center justify-center h-48 gap-3">
      <WifiOff className="h-6 w-6 text-slate-500 dark:text-slate-500" />
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {message ?? 'Failed to load data'}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10 transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
          Retry
        </button>
      )}
    </div>
  );
}
