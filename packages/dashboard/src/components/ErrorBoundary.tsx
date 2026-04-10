import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <AlertTriangle className="h-8 w-8 text-fuchsia-500" />
          <div className="text-center">
            <p className="text-slate-800 dark:text-slate-200 font-medium">Something went wrong</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {this.state.error?.message ?? 'An unexpected error occurred'}
            </p>
          </div>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/20 text-sm font-medium transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
