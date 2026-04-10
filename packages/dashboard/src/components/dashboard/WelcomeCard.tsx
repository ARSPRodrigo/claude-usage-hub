import { Gauge, RefreshCw, Terminal } from 'lucide-react';

export function WelcomeCard() {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-dark-600 bg-white dark:bg-dark-800 p-10 text-center max-w-lg mx-auto mt-16">
      <div className="inline-flex p-4 rounded-2xl bg-cyan-50 dark:bg-cyan-900/15 mb-5">
        <Gauge className="h-10 w-10 text-cyan-600 dark:text-cyan-400" />
      </div>

      <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-2">
        No usage data yet
      </h2>

      <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-6">
        Start using Claude Code and your token usage will appear here automatically.
        The collector scans for new data every 5 minutes.
      </p>

      <div className="space-y-3 text-left max-w-xs mx-auto">
        <div className="flex items-start gap-3 text-sm">
          <Terminal className="h-4 w-4 text-slate-400 dark:text-slate-500 mt-0.5 flex-shrink-0" />
          <span className="text-slate-600 dark:text-slate-400">
            Usage is collected from <code className="text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-dark-700 text-cyan-600 dark:text-cyan-400">~/.claude/projects/</code>
          </span>
        </div>
        <div className="flex items-start gap-3 text-sm">
          <RefreshCw className="h-4 w-4 text-slate-400 dark:text-slate-500 mt-0.5 flex-shrink-0" />
          <span className="text-slate-600 dark:text-slate-400">
            This page refreshes automatically every 60 seconds
          </span>
        </div>
      </div>
    </div>
  );
}
