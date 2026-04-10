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

export function useGoogleScript(): boolean {
  const [loaded, setLoaded] = useState(!!window.google);

  useEffect(() => {
    if (window.google) { setLoaded(true); return; }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => setLoaded(true);
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, []);

  return loaded;
}
