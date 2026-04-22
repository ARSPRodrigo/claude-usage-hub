import { Gauge, RefreshCw, Terminal } from 'lucide-react';

export function WelcomeCard() {
  return (
    <div className="rounded-card border border-line bg-surface p-10 text-center max-w-lg mx-auto mt-16">
      <div className="inline-flex p-4 rounded-2xl mb-5" style={{ background: 'color-mix(in oklch, var(--accent) 10%, transparent)' }}>
        <Gauge className="h-10 w-10 text-accent" />
      </div>

      <h2 className="text-xl font-medium mb-2" style={{ letterSpacing: '-0.015em' }}>
        No usage data yet
      </h2>

      <p className="text-ink-3 text-sm leading-relaxed mb-6">
        Start using Claude Code and your token usage will appear here automatically.
        The collector scans for new data every 5 minutes.
      </p>

      <div className="space-y-3 text-left max-w-xs mx-auto">
        <div className="flex items-start gap-3 text-sm">
          <Terminal className="h-4 w-4 text-ink-3 mt-0.5 flex-shrink-0" />
          <span className="text-ink-2">
            Usage is collected from <code className="mono text-xs px-1.5 py-0.5 rounded bg-canvas-alt border border-line">~/.claude/projects/</code>
          </span>
        </div>
        <div className="flex items-start gap-3 text-sm">
          <RefreshCw className="h-4 w-4 text-ink-3 mt-0.5 flex-shrink-0" />
          <span className="text-ink-2">
            This page refreshes automatically every 60 seconds
          </span>
        </div>
      </div>
    </div>
  );
}
