import { useState } from 'react';
import { getUser } from '@/api/client';
import { Monitor, BarChart3, HelpCircle, ShieldCheck } from 'lucide-react';

type Tab = 'getting-started' | 'understanding-data' | 'admin';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-3">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300 w-40 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{children}</span>
    </div>
  );
}

function Code({ children }: { children: string }) {
  return (
    <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-dark-800 text-xs font-mono text-cyan-700 dark:text-cyan-400">
      {children}
    </code>
  );
}

function GettingStarted() {
  return (
    <div>
      <Section title="How it works">
        <Item label="Collector agent">
          A small background process runs on each developer's machine. Every 30 minutes it reads
          Claude Code's local usage logs, strips all content and project paths, and sends only token
          counts and cost data to the central server.
        </Item>
        <Item label="What is collected">
          Token counts (input, output, cache), model used, session ID, cost estimate, and an
          opaque project alias. No code, no prompts, no file names — ever.
        </Item>
        <Item label="What is NOT collected">
          Source code, prompt content, file paths, project names, or any identifiable information
          about what you are working on.
        </Item>
      </Section>

      <Section title="Dashboard pages">
        <Item label="Dashboard">
          Your personal usage overview — total tokens, cost trend, model mix, and a daily cost
          bar chart. Use the time range selector (5h / 24h / 7d / 30d / All) to focus on any period.
        </Item>
        <Item label="Projects">
          Usage broken down by project. Projects appear as opaque aliases (e.g.{' '}
          <Code>autumn-river</Code>) to preserve privacy — only you know which alias maps to which
          project on your machine.
        </Item>
        <Item label="Sessions">
          Individual Claude Code sessions with token breakdown and model used. Click any session
          to see per-model detail.
        </Item>
      </Section>

      <Section title="Adding a machine">
        <Item label="Generate a key">
          Go to <strong>Profile</strong> → <strong>Generate new API key</strong>. Give it a label
          (e.g. "Work MacBook"). The key is shown once — copy it before leaving.
        </Item>
        <Item label="Install on macOS / Linux">
          <span>Run in your terminal:<br />
            <Code>{'curl -sSL https://<server>/install.sh | CHUB_API_KEY=chub_... sh'}</Code>
          </span>
        </Item>
        <Item label="Install on Windows">
          <span>Run in PowerShell:<br />
            <Code>{'$env:CHUB_API_KEY="chub_..."; irm https://<server>/install.ps1 | iex'}</Code>
          </span>
        </Item>
        <Item label="Machine status">
          After the first successful sync, your machine appears as <strong>Connected</strong> in
          Profile. <strong>Not connected</strong> means the key was generated but the collector
          has not checked in yet.
        </Item>
      </Section>
    </div>
  );
}

function UnderstandingData() {
  return (
    <div>
      <Section title="Token types">
        <Item label="Input tokens">
          Text you send to Claude — your messages, system prompts, and any context provided.
        </Item>
        <Item label="Output tokens">
          Text Claude generates in response. These are the most expensive per-token.
        </Item>
        <Item label="Cache creation">
          Tokens written into Claude's prompt cache. Charged at a higher rate but saves cost on
          repeated context.
        </Item>
        <Item label="Cache read">
          Tokens read from the prompt cache. Charged at a lower rate than input tokens.
        </Item>
      </Section>

      <Section title="Cost calculation">
        <Item label="How cost is estimated">
          Cost is calculated using Anthropic's published API pricing per model. The collector
          applies the correct per-token rates for each model at the time of collection.
        </Item>
        <Item label="Accuracy">
          Costs are estimates based on API pricing. Actual Claude Team plan billing may differ
          depending on your plan structure.
        </Item>
      </Section>

      <Section title="Privacy and aliases">
        <Item label="Project aliases">
          Each project directory is hashed into a short human-readable alias (e.g.{' '}
          <Code>autumn-river</Code>, <Code>silent-lake</Code>). The alias is consistent across
          sessions for the same project, but the original path is never sent to the server.
        </Item>
        <Item label="Salt">
          Each collector instance uses a unique random salt when hashing, so the same project
          produces a different alias on different machines — making cross-machine correlation
          impossible.
        </Item>
      </Section>

      <Section title="Time ranges">
        <Item label="5h">Last 5 hours — useful for checking a current work session.</Item>
        <Item label="24h">Last 24 hours — typical daily view.</Item>
        <Item label="7d">Last 7 days — weekly usage pattern.</Item>
        <Item label="30d">Last 30 days — monthly summary.</Item>
        <Item label="All">All data on the server since your first sync.</Item>
      </Section>
    </div>
  );
}

function AdminGuide() {
  return (
    <div>
      <Section title="Inviting team members">
        <Item label="Generate invite">
          Go to <strong>Team</strong> → enter the member's email → select role (Member or Owner)
          → click <strong>Generate link</strong>. Send the link to the person.
        </Item>
        <Item label="Expiry">
          Invite links expire after 7 days. If a link expires, use the <strong>Resend</strong>
          button on the Team page to generate a new one.
        </Item>
        <Item label="Acceptance">
          The invitee opens the link, signs in with their organisation Google account, and is
          taken to a setup page with their API key and install instructions.
        </Item>
      </Section>

      <Section title="Roles">
        <Item label="Member (Developer)">
          Can see their own usage — Dashboard, Projects, Sessions, Profile. Cannot see other
          members' data or access admin pages.
        </Item>
        <Item label="Owner">
          Can see all members' usage, access the Overview and Team pages, wipe member or machine
          data, and change org settings. Cannot change another owner's role.
        </Item>
        <Item label="Primary Owner">
          The first account created on the server (from <Code>ADMIN_EMAIL</Code>). Same
          permissions as Owner. Cannot be removed or demoted.
        </Item>
      </Section>

      <Section title="Overview page">
        <Item label="Per-member table">
          Shows all members with total tokens, cost, share of org total, and activity status
          (active within 24h, recent within 7d, idle, or never seen).
        </Item>
        <Item label="Drilling in">
          Click any member row to see their individual timeseries, model mix, and per-machine
          breakdown.
        </Item>
        <Item label="Wiping data">
          Hover a member row and click the trash icon to wipe all usage data for that member.
          On the member detail page, you can wipe a specific machine instead.
        </Item>
      </Section>

      <Section title="Settings">
        <Item label="Organisation name">Displayed in the dashboard header.</Item>
        <Item label="Data retention">
          Automatically delete usage entries older than N days. Set to 0 to keep data forever.
        </Item>
        <Item label="Danger zone">
          Delete all usage data across the entire organisation. This cannot be undone.
        </Item>
      </Section>
    </div>
  );
}

const TABS: { id: Tab; label: string; icon: typeof HelpCircle; adminOnly?: boolean }[] = [
  { id: 'getting-started', label: 'Getting Started', icon: Monitor },
  { id: 'understanding-data', label: 'Your Data', icon: BarChart3 },
  { id: 'admin', label: 'Admin Guide', icon: ShieldCheck, adminOnly: true },
];

export function HelpPage() {
  const user = getUser();
  const isAdmin = user?.role === 'primary_owner' || user?.role === 'owner';
  const [activeTab, setActiveTab] = useState<Tab>('getting-started');

  const visibleTabs = TABS.filter((t) => !t.adminOnly || isAdmin);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Help</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          How to use Claude Usage Hub
        </p>
      </div>

      <div className="bg-white dark:bg-dark-900 rounded-lg border border-slate-200 dark:border-dark-800 overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-dark-800">
          {visibleTabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === id
                  ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-900/10'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-dark-800'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'getting-started' && <GettingStarted />}
          {activeTab === 'understanding-data' && <UnderstandingData />}
          {activeTab === 'admin' && isAdmin && <AdminGuide />}
        </div>
      </div>
    </div>
  );
}
