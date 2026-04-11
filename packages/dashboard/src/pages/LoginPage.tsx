import { useEffect, useRef, useState } from 'react';
import { Gauge, Zap, Users, BarChart3 } from 'lucide-react';
import { setToken, setUser, type StoredUser } from '@/api/client';
import { fetchServerConfig, useGoogleScript } from '@/lib/useGoogleSignIn';

const FEATURES = [
  { icon: BarChart3, label: 'Token usage analytics', desc: 'Track input, output and cache tokens across all models' },
  { icon: Users, label: 'Team visibility', desc: 'See usage and cost breakdowns per developer' },
  { icon: Zap, label: 'Real-time data', desc: 'Collector pushes data continuously from every machine' },
];

export function LoginPage() {
  const googleLoaded = useGoogleScript();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!googleLoaded || !buttonRef.current) return;

    fetchServerConfig().then((config) => {
      if (!config.googleClientId) {
        setError('Google Sign-In is not configured on this server.');
        return;
      }

      window.google!.accounts.id.initialize({
        client_id: config.googleClientId,
        callback: async ({ credential }) => {
          setLoading(true);
          setError(null);
          try {
            const res = await fetch('/auth/google/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ idToken: credential }),
            });
            const data = await res.json() as { token?: string; user?: { id: string; email: string; displayName: string; role: string; developerId: string }; error?: string };
            if (!res.ok) throw new Error(data.error ?? 'Sign-in failed');
            setToken(data.token!);
            setUser(data.user! as StoredUser);
            window.location.href = '/';
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Sign-in failed');
            setLoading(false);
          }
        },
      });

      window.google!.accounts.id.renderButton(buttonRef.current!, {
        theme: 'outline',
        size: 'large',
        width: 280,
        text: 'signin_with',
        shape: 'rectangular',
      });
    }).catch(() => setError('Failed to load configuration.'));
  }, [googleLoaded]);

  return (
    <div className="min-h-screen flex">

      {/* ── Left brand panel ─────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-7/12 flex-col relative overflow-hidden bg-dark-950">

        {/* Dot-grid texture */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: 'radial-gradient(circle, #7dd3fc 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />

        {/* Radial glow behind logo */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

        {/* Content */}
        <div className="relative flex flex-col flex-1 px-16 py-14">

          {/* Top wordmark */}
          <div className="flex items-center gap-2.5">
            <Gauge className="h-5 w-5 text-cyan-400 flex-shrink-0" />
            <span className="text-sm font-semibold text-slate-300 tracking-wide">Claude Usage Hub</span>
            <span className="ml-1 text-xs px-1.5 py-0.5 rounded bg-cyan-900/40 text-cyan-400 font-medium label-mono">alpha</span>
          </div>

          {/* Center hero */}
          <div className="flex-1 flex flex-col justify-center">
            <div className="mb-10">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-cyan-500/15 border border-cyan-500/20 mb-6">
                <Gauge className="h-8 w-8 text-cyan-400" />
              </div>
              <h1 className="text-4xl font-bold text-white mb-3" style={{ letterSpacing: '-0.03em' }}>
                Understand how your<br />team uses Claude.
              </h1>
              <p className="text-slate-400 text-base leading-relaxed max-w-sm">
                A self-hosted usage hub for teams on the Claude Team or Pro plan — token analytics, cost breakdown, and per-developer visibility.
              </p>
            </div>

            {/* Feature list */}
            <div className="space-y-5">
              {FEATURES.map(({ icon: Icon, label, desc }) => (
                <div key={label} className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-dark-700 border border-dark-600 flex items-center justify-center mt-0.5">
                    <Icon className="h-4 w-4 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-200">{label}</p>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom */}
          <p className="text-xs text-dark-500 label-mono">Built for your organization</p>
        </div>
      </div>

      {/* ── Right login panel ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 dark:bg-dark-900 px-6 py-12">

        {/* Mobile logo (hidden on desktop) */}
        <div className="lg:hidden flex items-center gap-2.5 mb-10">
          <Gauge className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Claude Usage Hub</span>
        </div>

        <div className="w-full max-w-sm">

          {/* Card */}
          <div className="bg-white dark:bg-dark-800 rounded-lg border border-slate-200 dark:border-dark-600 p-8 shadow-card">

            <p className="label-mono text-slate-400 dark:text-slate-500 mb-3">Sign in</p>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
              Welcome back
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-7">
              Use your organization Google account to continue.
            </p>

            {error && (
              <div className="mb-5 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
                {error}
              </div>
            )}

            <div className="flex justify-center">
              {loading ? (
                <div className="h-10 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                  <svg className="animate-spin h-4 w-4 text-cyan-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Signing in…
                </div>
              ) : (
                <div ref={buttonRef} />
              )}
            </div>
          </div>

          <p className="mt-5 text-center text-xs text-slate-400 dark:text-dark-500">
            Access is restricted to approved organization members.
          </p>
        </div>
      </div>

    </div>
  );
}
