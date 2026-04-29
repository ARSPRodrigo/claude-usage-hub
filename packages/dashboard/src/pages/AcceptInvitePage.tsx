import { useEffect, useRef, useState } from 'react';
import { Gauge } from 'lucide-react';
import { setToken, setUser, type StoredUser } from '@/api/client';
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
              user?: { id: string; email: string; displayName: string; role: string; developerId: string };
              apiKey?: { key: string; label: string; developerId: string };
              error?: string;
            };
            if (!res.ok) throw new Error(data.error ?? 'Failed to accept invitation');

            setToken(data.token!);
            setUser(data.user! as StoredUser);

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
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <div className="text-center text-neg">Invalid invitation link.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas">
      <div className="w-full max-w-sm p-8 bg-surface rounded-card shadow-popover border border-line">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4" style={{ background: 'color-mix(in oklch, var(--accent) 10%, transparent)' }}>
            <Gauge className="h-6 w-6 text-accent" />
          </div>
          <h1 className="text-2xl font-bold text-ink">You&apos;re invited!</h1>
          <p className="mt-2 text-sm text-ink-3">
            Sign in with your organization Google account to join Claude Usage Hub.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-btn text-sm text-neg" style={{ background: 'color-mix(in oklch, var(--neg) 8%, transparent)', border: '1px solid color-mix(in oklch, var(--neg) 20%, transparent)' }}>
            {error}
          </div>
        )}

        <div className="flex justify-center">
          {loading ? (
            <div className="h-10 flex items-center text-sm text-ink-3">Setting up your account…</div>
          ) : (
            <div ref={buttonRef} />
          )}
        </div>
      </div>
    </div>
  );
}
