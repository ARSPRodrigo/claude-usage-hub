import { Moon, Sun, Gauge, ChevronDown, LogOut, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { clearAuth, getUser } from '@/api/client';

type InnerPage = 'dashboard' | 'sessions' | 'projects' | 'profile' | 'admin-org' | 'admin-team' | 'settings' | 'developer-detail';

interface HeaderProps {
  onNavigate?: (page: InnerPage) => void;
}

const ROLE_LABELS: Record<string, string> = {
  primary_owner: 'Primary Owner',
  owner: 'Owner',
  developer: 'Developer',
};

const ROLE_BADGE_CLASSES: Record<string, string> = {
  primary_owner: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
  owner: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  developer: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
};

export function Header({ onNavigate }: HeaderProps) {
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('theme') === 'dark' ||
      (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const user = getUser();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClick);
    }
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  function handleSignOut() {
    clearAuth();
    window.location.replace('/login');
  }

  function handleProfileClick() {
    setMenuOpen(false);
    if (onNavigate) {
      onNavigate('profile');
    } else {
      window.history.pushState({}, '', '/profile');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }

  const initials = user?.displayName
    ? user.displayName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() ?? '?';

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

      <div className="flex items-center gap-2">
        {/* Dark mode toggle */}
        <button
          onClick={() => setDark(!dark)}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-dark-700 text-slate-500 dark:text-slate-400 transition-colors"
          aria-label="Toggle theme"
        >
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        {/* User menu */}
        {user && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-dark-700 transition-colors"
            >
              <div className="h-7 w-7 rounded-full bg-cyan-600 dark:bg-cyan-700 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                {initials}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-medium text-slate-800 dark:text-slate-200 leading-none">
                  {user.displayName || user.email}
                </p>
                <p className="text-xs text-slate-400 leading-none mt-0.5">{user.email}</p>
              </div>
              <ChevronDown className="h-3 w-3 text-slate-400" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-1 w-64 rounded-lg border border-slate-200 dark:border-dark-600 bg-white dark:bg-dark-900 shadow-lg z-50">
                {/* User info */}
                <div className="px-4 py-3 border-b border-slate-100 dark:border-dark-700">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                      {user.email}
                    </p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${ROLE_BADGE_CLASSES[user.role] ?? ROLE_BADGE_CLASSES['developer']}`}
                    >
                      {ROLE_LABELS[user.role] ?? user.role}
                    </span>
                  </div>
                </div>

                {/* Links */}
                <div className="py-1">
                  <button
                    onClick={handleProfileClick}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-dark-800 transition-colors"
                  >
                    <User className="h-4 w-4 text-slate-400" />
                    Profile &amp; API Keys
                  </button>
                </div>

                <div className="border-t border-slate-100 dark:border-dark-700 py-1">
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
