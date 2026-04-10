import { useEffect, useRef, useState } from 'react';
import { setToken, setUser } from '@/api/client';
import { fetchServerConfig, useGoogleScript } from '@/lib/useGoogleSignIn';

export function AcceptInvitePage() {
  const token = new URLSearchParams(window.location.search).get('token');
  const googleLoaded = useGoogleScript();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) { setError('Invalid invitation link — token is missing.'); return; }
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
            const res = await fetch('/auth/invite/accept', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token, idToken: credential }),
            });
            const data = await res.json() as {
              token?: string;
              user?: { id: string; email: string; displayName: string; role: 'admin' | 'developer'; developerId: string };
              apiKey?: { key: string; label: string; developerId: string };
              error?: string;
            };
            if (!res.ok) throw new Error(data.error ?? 'Failed to accept invitation');

            setToken(data.token!);
            setUser(data.user!);

            // Store API key in sessionStorage — shown once on setup page
            if (data.apiKey) {
              sessionStorage.setItem('chub_setup_key', JSON.stringify(data.apiKey));
            }

            window.location.href = '/setup';
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to accept invitation');
            setLoading(false);
          }
        },
      });

      window.google!.accounts.id.renderButton(buttonRef.current!, {
        theme: 'outline',
        size: 'large',
        width: 280,
        text: 'continue_with',
        shape: 'rectangular',
      });
    }).catch(() => setError('Failed to load configuration.'));
  }, [googleLoaded, token]);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-dark-950">
        <div className="text-center text-red-600 dark:text-red-400">Invalid invitation link.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-dark-950">
      <div className="w-full max-w-sm p-8 bg-white dark:bg-dark-900 rounded-2xl shadow-lg border border-slate-200 dark:border-dark-800">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">You're invited!</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Sign in with your organization Google account to join Claude Usage Hub.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="flex justify-center">
          {loading ? (
            <div className="h-10 flex items-center text-sm text-slate-500">Setting up your account…</div>
          ) : (
            <div ref={buttonRef} />
          )}
        </div>
      </div>
    </div>
  );
}
