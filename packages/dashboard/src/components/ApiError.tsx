import { WifiOff } from 'lucide-react';

interface ApiErrorProps {
  message?: string;
  onRetry?: () => void;
}

export function ApiError({ message, onRetry }: ApiErrorProps) {
  return (
    <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
      <WifiOff className="h-8 w-8 text-ink-3" />
      <p className="text-ink-2 text-sm">{message ?? 'Failed to load data'}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-1.5 text-sm font-medium rounded-btn border border-line bg-surface text-ink hover:bg-canvas-alt transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  );
}
