import { useEffect, useRef, useState } from 'react';
import { Gauge, Zap, Users, BarChart3, Github, Sun, Moon } from 'lucide-react';
import { setToken, setUser, type StoredUser } from '@/api/client';
import { fetchServerConfig, useGoogleScript } from '@/lib/useGoogleSignIn';

const FEATURES = [
  { icon: BarChart3, label: 'Token usage analytics', desc: 'Track input, output and cache tokens across all models' },
  { icon: Users, label: 'Team visibility', desc: 'See usage and cost breakdowns per developer' },
  { icon: Zap, label: 'Real-time data', desc: 'Collector pushes data continuously from every machine' },
];

export function LoginPage() {
  const { loaded: googleLoaded, error: googleError } = useGoogleScript();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dark, setDark] = useState(() =>
    localStorage.getItem('theme') === 'dark' ||
    (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)
  );

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };

  const [googleReady, setGoogleReady] = useState(false);

  useEffect(() => {
    if (googleError) { setError(googleError); return; }
    if (!googleLoaded) return;

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
      setGoogleReady(true);
    }).catch(() => setError('Failed to load configuration.'));
  }, [googleLoaded]);

  useEffect(() => {
    if (!googleReady || !buttonRef.current) return;
    window.google!.accounts.id.renderButton(buttonRef.current, {
      theme: 'outline',
      size: 'large',
      width: 320,
      text: 'signin_with',
      shape: 'rectangular',
    });
  }, [googleReady]);

  return (
    <div className="min-h-screen flex">

      {/* ── Left brand panel ─────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-7/12 flex-col relative overflow-hidden bg-canvas">

        {/* Dot-grid texture */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: 'radial-gradient(circle, var(--ink-3) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />

        {/* Radial glow behind logo */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-3xl pointer-events-none"
          style={{ background: 'color-mix(in oklch, var(--accent) 5%, transparent)' }}
        />

        {/* Content */}
        <div className="relative flex flex-col flex-1 px-16 py-14">

          {/* Top wordmark */}
          <div className="flex items-center gap-2.5">
            <Gauge className="h-5 w-5 text-accent flex-shrink-0" />
            <span className="text-sm font-semibold text-ink-2 tracking-wide">Claude Usage Hub</span>
            <span className="label ml-1 px-1.5 py-0.5 rounded-pill" style={{ background: 'color-mix(in oklch, var(--accent) 12%, transparent)', color: 'var(--accent)' }}>beta</span>
          </div>

          {/* Center hero */}
          <div className="flex-1 flex flex-col justify-center">
            <div className="mb-10">
              <div
                className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6"
                style={{ background: 'color-mix(in oklch, var(--accent) 10%, transparent)', border: '1px solid color-mix(in oklch, var(--accent) 20%, transparent)' }}
              >
                <Gauge className="h-8 w-8 text-accent" />
              </div>
              <h1 className="text-4xl font-bold text-ink mb-3" style={{ letterSpacing: '-0.03em' }}>
                Understand how your<br />team uses Claude.
              </h1>
              <p className="text-ink-3 text-base leading-relaxed max-w-sm">
                A self-hosted usage hub for teams on the Claude Team or Pro plan — token analytics, cost breakdown, and per-developer visibility.
              </p>
            </div>

            {/* Feature list */}
            <div className="space-y-5">
              {FEATURES.map(({ icon: Icon, label, desc }) => (
                <div key={label} className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-surface border border-line flex items-center justify-center mt-0.5">
                    <Icon className="h-4 w-4 text-accent" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-ink">{label}</p>
                    <p className="text-xs text-ink-3 mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom */}
          <a
            href="https://github.com/ARSPRodrigo/claude-usage-hub"
            target="_blank"
            rel="noopener noreferrer"
            className="label flex items-center gap-2 text-ink-4 hover:text-ink-2 transition-colors"
          >
            <Github className="h-3.5 w-3.5" />
            Self-hosted · Open source
          </a>
        </div>
      </div>

      {/* ── Right login panel ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-canvas-alt px-6 py-12 relative">

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="absolute top-4 right-4 p-2 rounded-btn text-ink-3 hover:text-ink hover:bg-canvas transition-colors"
          title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        {/* Mobile logo (hidden on desktop) */}
        <div className="lg:hidden flex items-center gap-2.5 mb-10">
          <Gauge className="h-5 w-5 text-accent" />
          <span className="text-sm font-semibold text-ink">Claude Usage Hub</span>
        </div>

        <div className="w-full max-w-sm">

          {/* Card */}
          <div className="bg-surface rounded-card border border-line p-8 shadow-popover">

            <p className="label mb-3">Sign in</p>
            <h2 className="text-xl font-bold text-ink mb-1">
              Welcome back
            </h2>
            <p className="text-sm text-ink-3 mb-7">
              Use your organization Google account to continue.
            </p>

            {error && (
              <div className="mb-5 p-3 rounded-btn text-sm text-neg" style={{ background: 'color-mix(in oklch, var(--neg) 8%, transparent)', border: '1px solid color-mix(in oklch, var(--neg) 20%, transparent)' }}>
                {error}
              </div>
            )}

            <div className="flex justify-center">
              {loading ? (
                <div className="h-11 flex items-center gap-2 text-sm text-ink-3">
                  <svg className="animate-spin h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Signing in…
                </div>
              ) : !googleLoaded && !googleError ? (
                <div className="h-11 flex items-center gap-2 text-sm text-ink-3">
                  <svg className="animate-spin h-4 w-4 text-ink-3" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Loading…
                </div>
              ) : googleReady ? (
                <div className="relative w-full h-11 cursor-pointer group">
                  {/* Custom visual — shown to the user, non-interactive */}
                  <div className="absolute inset-0 flex items-center justify-center gap-3 rounded-btn border border-line bg-surface group-hover:bg-canvas-alt text-ink text-sm font-medium transition-colors select-none pointer-events-none">
                    <svg viewBox="0 0 24 24" className="h-5 w-5 flex-shrink-0">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Sign in with Google
                  </div>
                  {/* Real GSI iframe — invisible on top, catches the actual click. */}
                  <div
                    ref={buttonRef}
                    className="absolute inset-0 opacity-0 [&>div]:!w-full [&>div]:!h-full [&_iframe]:!w-full [&_iframe]:!h-full [&_iframe]:!m-0"
                  />
                </div>
              ) : null}
            </div>
          </div>

          <p className="mt-5 text-center text-xs text-ink-4">
            Access is restricted to approved organization members.
          </p>
        </div>
      </div>

    </div>
  );
}
