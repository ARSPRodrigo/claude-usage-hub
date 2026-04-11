import { useEffect, useState } from 'react';

interface ServerConfig {
  mode: string;
  googleClientId: string;
  allowedDomain: string;
}

let configCache: ServerConfig | null = null;

export async function fetchServerConfig(): Promise<ServerConfig> {
  if (configCache) return configCache;
  const res = await fetch('/api/v1/config');
  if (!res.ok) throw new Error('Failed to load server config');
  configCache = await res.json() as ServerConfig;
  return configCache;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (resp: { credential: string }) => void }) => void;
          prompt: () => void;
          renderButton: (el: HTMLElement, opts: object) => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

interface GoogleScriptState {
  loaded: boolean;
  error: string | null;
}

const LOAD_TIMEOUT_MS = 10_000;

export function useGoogleScript(): GoogleScriptState {
  const [state, setState] = useState<GoogleScriptState>({
    loaded: !!window.google,
    error: null,
  });

  useEffect(() => {
    if (window.google) return;

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;

    const timer = setTimeout(() => {
      setState({ loaded: false, error: 'Google Sign-In timed out. Check your network connection and try again.' });
    }, LOAD_TIMEOUT_MS);

    script.onload = () => {
      clearTimeout(timer);
      setState({ loaded: true, error: null });
    };

    script.onerror = () => {
      clearTimeout(timer);
      setState({ loaded: false, error: 'Could not load Google Sign-In. Your network may be blocking it.' });
    };

    document.head.appendChild(script);
    return () => {
      clearTimeout(timer);
      if (document.head.contains(script)) document.head.removeChild(script);
    };
  }, []);

  return state;
}
