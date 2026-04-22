import { useEffect, useState } from 'react';
import { Copy } from 'lucide-react';
import { getUser } from '@/api/client';

type Platform = 'mac' | 'linux' | 'linux-vm' | 'windows';

interface SetupKey {
  key: string;
  label: string;
  developerId: string;
}

function detectPlatform(): Platform {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('win')) return 'windows';
  if (ua.includes('mac')) return 'mac';
  return 'linux';
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-1.5 px-3 py-1 text-xs rounded-btn border border-line bg-surface text-ink hover:bg-canvas-alt transition-colors"
    >
      <Copy className="h-3 w-3" />
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="relative group rounded-btn bg-ink p-4 mt-2">
      <pre className="mono text-sm text-canvas whitespace-pre-wrap break-all pr-16" style={{ opacity: 0.85 }}>{code}</pre>
      <div className="absolute top-2 right-2">
        <CopyButton text={code} />
      </div>
    </div>
  );
}

const TAB_LABELS: Record<Platform, string> = {
  mac: 'macOS',
  linux: 'Linux',
  'linux-vm': 'Linux VM (SSH)',
  windows: 'Windows',
};

export function SetupPage() {
  const [apiKey, setApiKey] = useState<SetupKey | null>(null);
  const [platform, setPlatform] = useState<Platform>(detectPlatform());
  const [keySaved, setKeySaved] = useState(false);
  const user = getUser();
  const serverUrl = window.location.origin;

  useEffect(() => {
    const raw = sessionStorage.getItem('chub_setup_key');
    if (raw) {
      try { setApiKey(JSON.parse(raw) as SetupKey); } catch { /* ignore */ }
    }
  }, []);

  const installCmd = {
    mac: `curl -sSL ${serverUrl}/install.sh | CHUB_API_KEY=${apiKey?.key ?? 'chub_...'} sh`,
    linux: `curl -sSL ${serverUrl}/install.sh | CHUB_API_KEY=${apiKey?.key ?? 'chub_...'} sh`,
    'linux-vm': `# SSH into your VM, then run:\ncurl -sSL ${serverUrl}/install.sh | CHUB_API_KEY=${apiKey?.key ?? 'chub_...'} sh`,
    windows: `$env:CHUB_API_KEY="${apiKey?.key ?? 'chub_...'}"; irm ${serverUrl}/install.ps1 | iex`,
  };

  return (
    <div className="min-h-screen bg-canvas py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-ink" style={{ letterSpacing: '-0.025em' }}>
            Welcome, {user?.displayName ?? 'there'}!
          </h1>
          <p className="mt-2 text-ink-3">
            Let&apos;s get the collector running on your machine.
          </p>
        </div>

        {/* API Key — shown once */}
        {apiKey && (
          <div className="mb-6 p-4 rounded-card" style={{ background: 'color-mix(in oklch, var(--accent) 8%, transparent)', border: '1px solid color-mix(in oklch, var(--accent) 25%, transparent)' }}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold mb-1" style={{ color: 'var(--accent)' }}>
                  Your API key — save this now, it won&apos;t be shown again
                </p>
                <code className="mono text-xs break-all text-ink">
                  {apiKey.key}
                </code>
              </div>
              <CopyButton text={apiKey.key} />
            </div>
            <label className="mt-3 flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={keySaved}
                onChange={(e) => setKeySaved(e.target.checked)}
                className="rounded"
              />
              <span className="text-xs text-ink-2">I&apos;ve saved my API key</span>
            </label>
          </div>
        )}

        {/* Platform tabs */}
        <div className="bg-surface rounded-card border border-line overflow-hidden">
          <div className="flex border-b border-line">
            {(Object.keys(TAB_LABELS) as Platform[]).map((p) => (
              <button
                key={p}
                onClick={() => setPlatform(p)}
                className="flex-1 py-3 text-sm font-medium transition-colors"
                style={{
                  background: platform === p ? 'var(--ink)' : 'transparent',
                  color: platform === p ? 'var(--bg)' : 'var(--ink-2)',
                  borderBottom: platform === p ? 'none' : undefined,
                }}
              >
                {TAB_LABELS[p]}
              </button>
            ))}
          </div>

          <div className="p-6">
            {platform === 'linux-vm' && (
              <p className="mb-3 text-sm text-ink-2">
                Claude Code runs on your OCI/remote VM. SSH into it and run the command below — it will install the collector and register it as a systemd service.
              </p>
            )}
            {platform === 'windows' && (
              <p className="mb-3 text-sm text-ink-2">
                Run this in <strong>PowerShell</strong> (not Command Prompt). Node.js 18+ must be installed.
              </p>
            )}
            {(platform === 'mac' || platform === 'linux') && (
              <p className="mb-3 text-sm text-ink-2">
                Run this in your terminal. Node.js 18+ must be installed.
              </p>
            )}

            <p className="label mb-1">Install command</p>
            <CodeBlock code={installCmd[platform]} />

            <p className="mt-4 text-xs text-ink-3">
              This downloads the collector, configures it with your API key, and starts the background daemon automatically.
            </p>
          </div>
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              sessionStorage.removeItem('chub_setup_key');
              window.location.href = '/';
            }}
            className="px-6 py-2 bg-ink text-canvas rounded-btn text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Go to dashboard →
          </button>
          <p className="mt-2 text-xs text-ink-4">
            You can generate additional keys for other machines from your profile.
          </p>
        </div>
      </div>
    </div>
  );
}
