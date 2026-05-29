import { ArrowRight, ExternalLink, ChevronDown } from 'lucide-react';
import { getUser } from '@/api/client';
import { useHealth } from '@/api/hooks';

const GITHUB_REPO = 'https://github.com/ARSPRodrigo/claude-usage-hub';

const JUMP_TO: { label: string; id: string }[] = [
  { label: 'Quickstart', id: 'quickstart' },
  { label: 'Windows install', id: 'windows-install' },
  { label: 'Roles & permissions', id: 'roles' },
  { label: 'Organizations & workspaces', id: 'orgs' },
  { label: 'Privacy', id: 'privacy' },
  { label: 'FAQ', id: 'faq' },
];

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function HelpPage() {
  const user = getUser();
  const health = useHealth();

  const sections = [
    {
      id: 'quickstart',
      label: 'H1',
      title: 'Quickstart',
      body: (
        <div className="text-ink-2 text-[13.5px] leading-relaxed">
          <p className="mb-3">
            On each machine you use Claude Code, run the collector with your personal API key. It reads
            token metadata from <code className="mono text-xs bg-canvas-alt px-1.5 py-0.5 rounded-pill border border-line">~/.claude/projects/**</code> and posts it to the hub.
          </p>
          <p className="mb-3">
            Generate a key from <strong>Profile &amp; Keys</strong>, then copy the one-line install command
            for your OS. The exact command (including a fresh key) is shown right there — these are
            templates:
          </p>
          <div className="bg-ink text-canvas p-3.5 rounded-btn mono text-[12.5px] leading-[1.7] overflow-auto">
            <span className="text-ink-4"># macOS / Linux</span><br />
            curl -sSL https://your-hub/install.sh | CHUB_API_KEY=chub_… sh<br />
            <br />
            <span className="text-ink-4"># Windows (admin not required — auto-detects)</span><br />
            $env:CHUB_API_KEY='chub_…'; iwr https://your-hub/install.ps1 -OutFile<br />
            &nbsp;&nbsp;"$env:TEMP\install-chub.ps1" -UseBasicParsing; powershell<br />
            &nbsp;&nbsp;-ExecutionPolicy Bypass -File "$env:TEMP\install-chub.ps1"
          </div>
          <p className="mt-3">
            The installer downloads the collector, initializes config under your home directory, and
            registers a background daemon: <strong>launchd</strong> on macOS, <strong>systemd user
            service</strong> on Linux, or one of two backends on Windows (see next section).
          </p>
        </div>
      ),
    },
    {
      id: 'windows-install',
      label: 'H2',
      title: 'Windows install',
      body: (
        <div className="text-[13.5px] text-ink-2 leading-relaxed space-y-3">
          <p>
            Windows ships with a <strong>self-contained <code className="mono text-xs bg-canvas-alt px-1 rounded">collector.exe</code></strong> built via Node SEA —
            no Node.js installation required on the target machine.
          </p>
          <p>
            The installer auto-detects whether your PowerShell is elevated and picks the right backend:
          </p>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-line-2">
                <th className="label text-left py-2">Shell</th>
                <th className="label text-left py-2">Backend</th>
                <th className="label text-left py-2">Starts on</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Administrator', 'Windows Service (via NSSM)', 'Boot — runs without anyone logged in'],
                ['Standard user', 'Hidden Scheduled Task', 'User logon — no UAC prompt, no IT admin needed'],
              ].map(([s, b, t], i) => (
                <tr key={s} style={{ borderBottom: i === 1 ? 'none' : '1px solid var(--line-2)' }}>
                  <td className="py-2.5 font-medium">{s}</td>
                  <td className="py-2.5">{b}</td>
                  <td className="py-2.5 text-ink-3">{t}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            Either backend runs hidden (no console window), restarts automatically on crash, and uploads
            on a 5-minute cycle. Corporate machines where the developer isn't a local administrator can
            still install with one command — the Scheduled Task path needs no elevation.
          </p>
          <p className="text-ink-3">
            If something fails, re-run with <code className="mono text-xs bg-canvas-alt px-1 rounded">collector.exe install --verbose</code> for
            full diagnostic output (resolved user SID, generated XML path, schtasks stderr).
          </p>
        </div>
      ),
    },
    {
      id: 'roles',
      label: 'H3',
      title: 'Roles & permissions',
      body: (
        <div className="text-[13.5px] text-ink-2 leading-relaxed space-y-3">
          <p>
            The Hub has a five-tier role hierarchy. Two of them are <em>platform-level roles</em>
            (stored on the user) and two are <em>grants</em> on individual orgs or workspaces (stored in
            join tables, so one user can hold any combination).
          </p>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-line-2">
                <th className="label text-left py-2">Role</th>
                <th className="label text-left py-2">Type</th>
                <th className="label text-left py-2">Can do</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Platform Owner', 'Role (one)', 'Everything. The singular owner — can transfer ownership but not be removed.'],
                ['Platform Admin', 'Role (many)', 'Manage orgs / workspaces / members across the whole platform. Cannot transfer the Platform Owner role.'],
                ['Org Owner', 'Grant (per-org)', 'Manage workspaces, members, and grants inside a specific org. Can own multiple orgs.'],
                ['Workspace Owner', 'Grant (per-workspace)', 'Manage one specific workspace inside an org.'],
                ['Developer', 'Role (default)', 'See only their own usage. No admin or management surface.'],
              ].map(([r, t, c], i, arr) => (
                <tr key={r} style={{ borderBottom: i === arr.length - 1 ? 'none' : '1px solid var(--line-2)' }}>
                  <td className="py-2.5 font-medium whitespace-nowrap">{r}</td>
                  <td className="py-2.5 text-ink-3 whitespace-nowrap">{t}</td>
                  <td className="py-2.5">{c}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-ink-3">
            Org Owner and Workspace Owner are <em>grants</em>, not exclusive roles — a Platform Admin
            can also own specific orgs, and a Developer can be granted Workspace Owner without becoming
            a Platform Admin.
          </p>
        </div>
      ),
    },
    {
      id: 'orgs',
      label: 'H4',
      title: 'Organizations & workspaces',
      body: (
        <div className="text-[13.5px] text-ink-2 leading-relaxed space-y-3">
          <p>
            <strong>Organizations</strong> are top-level, parallel containers — there's no hierarchy
            between them. Inside each org you can create <strong>workspaces</strong> (team-level groups
            for billing, scoping dashboards, etc.).
          </p>
          <p>
            Every user has one <em>active</em> org + workspace membership at a time. When you move
            someone, historical usage stays attributed to where it was generated (time-bounded
            memberships); only new entries flow to the new org/workspace. This means you can re-org
            members without losing history.
          </p>
          <p>
            The <code className="mono text-xs bg-canvas-alt px-1 rounded">DEFAULT</code> badge on one
            organization in the Manage UI marks the migration-origin org — the system refuses to delete
            it because it holds pre-migration data. It behaves identically to any other org otherwise.
          </p>
          <p className="text-ink-3">
            <strong>Domain auto-assign rules</strong> (Manage → Domain rules) automatically route new
            sign-ups to a specific org + workspace based on their email domain — useful for onboarding a
            whole team without manual invites.
          </p>
        </div>
      ),
    },
    {
      id: 'privacy',
      label: 'H5',
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
    ['What tokens are counted in "Total Tokens"?', 'All four types: input, output, cache creation, and cache read. Cache tokens (especially cache reads) often account for 95%+ of the total because Claude Code re-sends conversation context on every turn and hits the prompt cache. The headline number can look much larger than what Claude Code\'s /usage stats show, which typically counts only input + output.'],
    ['How is cost estimated?', 'Cost is calculated using Anthropic\'s published API pricing per model and token type. Cache reads are 0.1x the input price, cache writes are 2x. The estimate reflects what the usage would cost on the API — your actual Claude Team/Pro subscription billing may differ.'],
    ['Does this work with Claude Pro, Team, and API plans?', 'Yes. The collector reads the same local JSONL logs regardless of plan. The cost estimate uses API pricing as a reference, but on Pro/Team plans your usage is covered by the subscription.'],
    ['Where does my data live?', 'On the hub server you self-host, in a SQLite file with 0600 permissions. Nothing is sent to Anthropic or any third party.'],
    ['How do project aliases work?', 'Each project directory is hashed with a unique per-machine salt into a human-readable alias (e.g. "autumn-river"). The original path is never sent to the server, and the same project produces different aliases on different machines — making cross-machine correlation impossible.'],
    ['Can multiple machines share one API key?', 'No. Each API key is tied to one machine. Generate a separate key per machine from your Profile page so you can track and revoke them independently.'],
    ['How often does the collector sync?', 'Every 5 minutes by default (configurable via intervalMinutes in config.json). The collector reads new JSONL entries since its last run, deduplicates streaming entries (keeps only the final token count per message), and posts the batch to the server.'],
    ['Do I need Administrator privileges on Windows?', 'No. The installer auto-detects: if your PowerShell is elevated it registers a Windows Service (boot-start); if not, it registers a hidden user-context Scheduled Task (logon-start). Both run with no visible console window and restart automatically on crash. Corporate developers who don\'t have local admin can install with one command.'],
    ['Do I need Node.js installed on Windows?', 'No. The Hub serves a self-contained collector.exe built via Node SEA (~90 MB), which bundles the Node.js runtime. The installer downloads it automatically. The dashboard\'s install snippet falls back to collector.js + Node.js only if the .exe isn\'t available on the Hub.'],
    ['Where are the collector logs?', 'macOS / Linux: ~/.claude-usage-hub/logs/collector.log. Windows: %USERPROFILE%\\.claude-usage-hub\\logs\\collector.log. You can tail it with `tail -f` (Unix) or `Get-Content -Wait` (PowerShell).'],
    ['What happens if the server is down?', 'The collector will retry on the next sync cycle. Local JSONL files are the source of truth — no data is lost. Entries will be picked up once the server is reachable again.'],
    ['Can I delete a machine?', 'Revoke its API key on the Profile & Keys page. Historical entries are preserved unless you explicitly wipe them.'],
    ['What if I rotate keys?', 'Generate a new key, install it on the machine, revoke the old one. Historical entries stay tied to the machine alias, not the key.'],
    ['Is there an alerting system?', 'Not yet. Budget thresholds and Slack/email alerts are on the roadmap.'],
  ];

  return (
    <div>
      {/* Page header */}
      <div className="flex items-end justify-between mb-6 gap-5 flex-wrap">
        <div>
          <div className="label mb-2">ACCOUNT</div>
          <h1 className="text-title m-0" style={{ fontSize: 36, lineHeight: 1.05 }}>Help & docs</h1>
          <div className="text-ink-3 mt-2 text-sm">
            Self-hosted, open source, privacy-first token tracking for Claude Code.
          </div>
        </div>
        <a
          href={GITHUB_REPO}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-line bg-surface rounded-btn text-[13px] font-medium text-ink hover:bg-canvas-alt transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          GitHub
        </a>
      </div>

      {/* Two-column layout */}
      <div className="grid gap-5" style={{ gridTemplateColumns: '1fr 260px' }}>
        {/* Main column */}
        <div className="flex flex-col gap-4">
          {sections.map((s) => (
            <div key={s.id} id={s.id} className="rounded-card border border-line bg-surface scroll-mt-16">
              <div className="px-5 py-4 border-b border-line-2">
                <div className="label">{s.label} · {s.title}</div>
                <div className="text-[17px] font-medium mt-1.5" style={{ letterSpacing: '-0.015em' }}>{s.title}</div>
              </div>
              <div className="p-5">{s.body}</div>
            </div>
          ))}

          {/* FAQ */}
          <div id="faq" className="rounded-card border border-line bg-surface scroll-mt-16">
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

        {/* Side rail — sticky so it stays visible while scrolling */}
        <div className="flex flex-col gap-3.5 sticky top-[60px] self-start">
          {/* Jump to */}
          <div className="rounded-card border border-line bg-surface p-4">
            <div className="label mb-2.5">Jump to</div>
            <div className="flex flex-col gap-2">
              {JUMP_TO.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollTo(item.id)}
                  className="text-[13px] text-ink-2 flex items-center justify-between hover:text-ink transition-colors cursor-pointer bg-transparent border-none p-0 text-left"
                >
                  {item.label} <ArrowRight className="h-3 w-3" />
                </button>
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
            <a
              href={`${GITHUB_REPO}/issues/new`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-[7px] bg-canvas text-ink rounded-btn text-[12.5px] font-medium cursor-pointer"
            >
              Report issue <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {/* Version */}
          <div className="rounded-card border border-line bg-surface p-4">
            <div className="label mb-2">Version</div>
            <div className="mono text-[13px]">v{health.data?.version ?? '0.3.0'}-beta</div>
          </div>
        </div>
      </div>
    </div>
  );
}
