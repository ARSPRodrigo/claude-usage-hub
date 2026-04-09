import { Moon, Sun, Activity } from 'lucide-react';
import { useEffect, useState } from 'react';

export function Header() {
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('theme') === 'dark' ||
      (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
      <div className="flex items-center gap-3">
        <Activity className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
        <h1 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
          Claude Usage Hub
        </h1>
        <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
          alpha
        </span>
      </div>
      <button
        onClick={() => setDark(!dark)}
        className="p-2 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 transition-colors"
        aria-label="Toggle theme"
      >
        {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>
    </header>
  );
}
