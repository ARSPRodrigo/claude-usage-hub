import { useState } from 'react';
import { ArrowRight, ExternalLink, ChevronDown } from 'lucide-react';
import { getUser } from '@/api/client';
import { useHealth } from '@/api/hooks';

export function HelpPage() {
  const user = getUser();
  const health = useHealth();
  const isAdmin = user?.role === 'primary_owner' || user?.role === 'owner';

  const sections = [
    {
      label: 'H1',
      title: 'Quickstart',
      body: (
        <div className="text-ink-2 text-[13.5px] leading-relaxed">
          <p className="mb-3">
            On each machine you use Claude Code, run the collector with your personal API key. It reads
            token metadata from <code className="mono text-xs bg-canvas-alt px-1.5 py-0.5 rounded-pill border border-line">~/.claude/projects/**</code> and posts it to the hub.
          </p>
          <div className="bg-ink text-canvas p-3.5 rounded-btn mono text-[12.5px] leading-[1.7] overflow-auto">
            <span className="text-ink-4"># install the collector</span><br />
            npm install -g @usage-hub/collector<br />
            <br />
            <span className="text-ink-4"># start reporting</span><br />
            cuh-collect start --api-key <span className="text-accent">cuh_live_…</span>
          </div>
        </div>
      ),
    },
    {
      label: 'H2',
      title: 'Roles & permissions',
      body: (
        <div className="text-[13.5px]">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-line-2">
                <th className="label text-left py-2">Role</th>
                <th className="label text-left py-2">Can do</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Primary Owner', 'Everything. One per org. Cannot be demoted.'],
                ['Owner', 'Invite, wipe per-member data, configure retention.'],
                ['Developer', 'See only their own dashboard, sessions and keys.'],
              ].map(([r, c], i) => (
                <tr key={r} style={{ borderBottom: i === 2 ? 'none' : '1px solid var(--line-2)' }}>
                  <td className="py-2.5 font-medium">{r}</td>
                  <td className="py-2.5 text-ink-2">{c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ),
    },
    {
      label: 'H3',
      title: 'Privacy',
      body: (
        <div className="text-[13.5px] text-ink-2 leading-relaxed">
          The collector only extracts <em>usage metadata</em> — model name, token counts and timestamps.
          Project paths are hashed into opaque aliases. Conversation content, file paths and code are never
          read or stored.
        </div>
      ),
    },
  ];

  const faq = [
    ['Where does my data live?', 'On the hub server you self-host, in a SQLite file with 0600 permissions.'],
    ['Can I delete a machine?', 'Revoke its API key on the Profile & Keys page. Historical entries are preserved unless you wipe them.'],
    ['What if I rotate keys?', 'Generate a new key, install it on the machine, revoke the old one. Entries stay tied to the machine alias.'],
    ['Is there an alerting system?', 'Budget thresholds and Slack/email alerts are on the roadmap.'],
  ];

  return (
    <div>
      {/* Page header */}
      <div className="flex items-end justify-between mb-6 gap-5 flex-wrap">
        <div>
          <div className="label mb-2">ACCOUNT · /HELP</div>
          <h1 className="text-title m-0" style={{ fontSize: 36, lineHeight: 1.05 }}>Help & docs</h1>
          <div className="text-ink-3 mt-2 text-sm">
            Self-hosted, open source, privacy-first token tracking for Claude Code.
          </div>
        </div>
        <button className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-line bg-surface rounded-btn text-[13px] font-medium text-ink cursor-pointer hover:bg-canvas-alt transition-colors">
          <ExternalLink className="h-3.5 w-3.5" />
          GitHub
        </button>
      </div>

      {/* Two-column layout */}
      <div className="grid gap-5" style={{ gridTemplateColumns: '1fr 260px' }}>
        {/* Main column */}
        <div className="flex flex-col gap-4">
          {sections.map((s) => (
            <div key={s.title} className="rounded-card border border-line bg-surface">
              <div className="px-5 py-4 border-b border-line-2">
                <div className="label">{s.label} · {s.title}</div>
                <div className="text-[17px] font-medium mt-1.5" style={{ letterSpacing: '-0.015em' }}>{s.title}</div>
              </div>
              <div className="p-5">{s.body}</div>
            </div>
          ))}

          {/* FAQ */}
          <div className="rounded-card border border-line bg-surface">
            <div className="px-5 py-4 border-b border-line-2">
              <div className="label">H4 · FAQ</div>
              <div className="text-[17px] font-medium mt-1.5" style={{ letterSpacing: '-0.015em' }}>Common questions</div>
            </div>
            <div>
              {faq.map(([q, a], i) => (
                <details key={q} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--line-2)' }}>
                  <summary className="px-5 py-3.5 cursor-pointer flex items-center justify-between font-medium text-[13.5px] list-none [&::-webkit-details-marker]:hidden">
                    {q}
                    <ChevronDown className="h-3.5 w-3.5 text-ink-3 flex-shrink-0" />
                  </summary>
                  <div className="px-5 pb-4 text-ink-2 text-[13px] leading-relaxed">{a}</div>
                </details>
              ))}
            </div>
          </div>
        </div>

        {/* Side rail */}
        <div className="flex flex-col gap-3.5">
          {/* Jump to */}
          <div className="rounded-card border border-line bg-surface p-4">
            <div className="label mb-2.5">Jump to</div>
            <div className="flex flex-col gap-2">
              {['Quickstart', 'Roles & permissions', 'Privacy', 'FAQ'].map((t) => (
                <a key={t} href="#" className="text-[13px] text-ink-2 flex items-center justify-between hover:text-ink transition-colors">
                  {t} <ArrowRight className="h-3 w-3" />
                </a>
              ))}
            </div>
          </div>

          {/* CTA card */}
          <div className="rounded-card bg-ink text-canvas p-4" style={{ border: 'none' }}>
            <div className="label mb-2" style={{ color: 'color-mix(in oklch, var(--bg) 60%, transparent)' }}>Need help?</div>
            <div className="text-[15px] font-medium mb-2.5" style={{ letterSpacing: '-0.01em' }}>Open an issue on GitHub</div>
            <div className="text-[12.5px] mb-3.5 leading-relaxed" style={{ color: 'color-mix(in oklch, var(--bg) 70%, transparent)' }}>
              This is an open-source tool. The fastest path to fixes is a reproducible issue.
            </div>
            <button className="inline-flex items-center gap-1.5 px-3 py-[7px] bg-canvas text-ink rounded-btn text-[12.5px] font-medium cursor-pointer">
              Report issue <ExternalLink className="h-3 w-3" />
            </button>
          </div>

          {/* Version */}
          <div className="rounded-card border border-line bg-surface p-4">
            <div className="label mb-2">Version</div>
            <div className="mono text-[13px]">v{health.data?.version ?? '0.2.0'}-beta</div>
            <div className="mono text-[11px] text-ink-3 mt-1">built Apr 22, 2026</div>
          </div>
        </div>
      </div>
    </div>
  );
}
