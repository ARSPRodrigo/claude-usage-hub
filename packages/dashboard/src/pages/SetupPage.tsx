import { useEffect, useState } from 'react';
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
      className="px-3 py-1 text-xs rounded bg-slate-200 dark:bg-dark-700 hover:bg-slate-300 dark:hover:bg-dark-600 text-slate-700 dark:text-slate-300 transition-colors"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="relative group rounded-lg bg-slate-900 dark:bg-black p-4 mt-2">
      <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap break-all pr-16">{code}</pre>
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
    <div className="min-h-screen bg-slate-50 dark:bg-dark-950 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            Welcome, {user?.displayName ?? 'there'}!
          </h1>
          <p className="mt-2 text-slate-500 dark:text-slate-400">
            Let's get the collector running on your machine.
          </p>
        </div>

        {/* API Key — shown once */}
        {apiKey && (
          <div className="mb-6 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-1">
                  ⚠ Your API key — save this now, it won't be shown again
                </p>
                <code className="text-xs text-amber-900 dark:text-amber-200 font-mono break-all">
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
              <span className="text-xs text-amber-700 dark:text-amber-400">I've saved my API key</span>
            </label>
          </div>
        )}

        {/* Platform tabs */}
        <div className="bg-white dark:bg-dark-900 rounded-2xl shadow border border-slate-200 dark:border-dark-800 overflow-hidden">
          <div className="flex border-b border-slate-200 dark:border-dark-800">
            {(Object.keys(TAB_LABELS) as Platform[]).map((p) => (
              <button
                key={p}
                onClick={() => setPlatform(p)}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  platform === p
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-dark-800'
                }`}
              >
                {TAB_LABELS[p]}
              </button>
            ))}
          </div>

          <div className="p-6">
            {platform === 'linux-vm' && (
              <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
                Claude Code runs on your OCI/remote VM. SSH into it and run the command below — it will install the collector and register it as a systemd service.
              </p>
            )}
            {platform === 'windows' && (
              <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
                Run this in <strong>PowerShell</strong> (not Command Prompt). Node.js 18+ must be installed.
              </p>
            )}
            {(platform === 'mac' || platform === 'linux') && (
              <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
                Run this in your terminal. Node.js 18+ must be installed.
              </p>
            )}

            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
              Install command
            </p>
            <CodeBlock code={installCmd[platform]} />

            <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
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
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Go to dashboard →
          </button>
          <p className="mt-2 text-xs text-slate-400">
            You can generate additional keys for other machines from your profile.
          </p>
        </div>
      </div>
    </div>
  );
}
