import { useEffect, useRef, useState } from 'react';
import { setToken, setUser, type StoredUser } from '@/api/client';
import { fetchServerConfig, useGoogleScript } from '@/lib/useGoogleSignIn';

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
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-dark-950">
      <div className="w-full max-w-sm p-8 bg-white dark:bg-dark-900 rounded-2xl shadow-lg border border-slate-200 dark:border-dark-800">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Claude Usage Hub</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Sign in with your organization account
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="flex justify-center">
          {loading ? (
            <div className="h-10 flex items-center text-sm text-slate-500">Signing in…</div>
          ) : (
            <div ref={buttonRef} />
          )}
        </div>
      </div>
    </div>
  );
}
