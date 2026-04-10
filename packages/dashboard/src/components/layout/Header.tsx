import { Moon, Sun, Gauge } from 'lucide-react';
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
    <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-dark-600 bg-white dark:bg-dark-900">
      <div className="flex items-center gap-3">
        <Gauge className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
        <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
          Claude Usage Hub
        </h1>
        <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-100 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-400">
          alpha
        </span>
      </div>
      <button
        onClick={() => setDark(!dark)}
        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-dark-700 text-slate-500 dark:text-slate-400 transition-colors"
        aria-label="Toggle theme"
      >
        {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>
    </header>
  );
}
