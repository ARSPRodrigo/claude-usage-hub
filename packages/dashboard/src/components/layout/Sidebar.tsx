import { BarChart3, FolderOpen, Clock, Github, Database, RefreshCw, Building2, Users, ChevronUp, User, Shield, LogOut, Sun, Moon, Gauge } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { useHealth } from '@/api/hooks';
import { getUser, clearAuth } from '@/api/client';

type Page = 'dashboard' | 'sessions' | 'projects' | 'profile' | 'admin-org' | 'admin-team' | 'settings' | 'developer-detail';

interface SidebarProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
}

const ROLE_LABELS: Record<string, string> = {
  primary_owner: 'Primary Owner',
  owner: 'Owner',
  developer: 'Developer',
};

export function Sidebar({ activePage, onNavigate }: SidebarProps) {
  const health = useHealth();
  const user = getUser();
  const isAdmin = user?.role === 'primary_owner' || user?.role === 'owner';

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    return (
      localStorage.getItem('theme') === 'dark' ||
      (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)
    );
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [menuOpen]);

  function handleSignOut() {
    clearAuth();
    window.location.replace('/login');
  }

  const initials = user?.displayName
    ? user.displayName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() ?? '?';

  function NavItem({ id, label, icon: Icon, extraActive }: { id: Page; label: string; icon: typeof BarChart3; extraActive?: Page }) {
    const isActive = activePage === id || activePage === extraActive;
    return (
      <li>
        <button
          onClick={() => onNavigate(id)}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
            isActive
              ? 'bg-cyan-100 dark:bg-cyan-900/15 text-cyan-700 dark:text-cyan-400'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-dark-700 hover:text-slate-800 dark:hover:text-slate-200',
          )}
        >
          <Icon className="h-4 w-4 flex-shrink-0" />
          {label}
        </button>
      </li>
    );
  }

  return (
    <nav className="w-56 border-r border-slate-200 dark:border-dark-600 bg-slate-100 dark:bg-dark-900 flex flex-col flex-shrink-0">
      {/* App branding */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-200 dark:border-dark-600">
        <div className="flex items-center gap-2.5">
          <Gauge className="h-5 w-5 text-cyan-600 dark:text-cyan-400 flex-shrink-0" />
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-tight">
            Claude Usage Hub
          </span>
        </div>
        <span className="mt-1.5 inline-block text-xs px-2 py-0.5 rounded-full bg-cyan-100 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-400 font-medium">
          alpha
        </span>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-2">
        {/* MY USAGE */}
        <div>
          <p className="label-mono text-slate-400 dark:text-slate-500 px-3 pt-3 pb-1">
            My Usage
          </p>
          <ul className="space-y-0.5 px-3 pb-2">
            <NavItem id="dashboard" label="Dashboard" icon={BarChart3} />
            <NavItem id="projects" label="Projects" icon={FolderOpen} />
            <NavItem id="sessions" label="Sessions" icon={Clock} />
          </ul>
        </div>

        {/* ORGANIZATION — admin only */}
        {isAdmin && (
          <div>
            <p className="label-mono text-slate-400 dark:text-slate-500 px-3 pt-3 pb-1">
              Organization
            </p>
            <ul className="space-y-0.5 px-3 pb-2">
              <NavItem id="admin-org" label="Org Overview" icon={Building2} extraActive="developer-detail" />
              <NavItem id="admin-team" label="Team" icon={Users} />
            </ul>
          </div>
        )}
      </div>

      {/* Footer stats */}
      <div className="px-4 py-3 border-t border-slate-200 dark:border-dark-600 space-y-1.5">
        <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
          <Database className="h-3 w-3 flex-shrink-0" />
          <span>{health.data ? `${health.data.entryCount.toLocaleString()} entries` : '…'}</span>
        </div>
        {health.data?.lastEntry && (
          <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
            <RefreshCw className="h-3 w-3 flex-shrink-0" />
            <span>
              {new Date(health.data.lastEntry).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        )}
        <a
          href="https://github.com/ARSPRodrigo/claude-usage-hub"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        >
          <Github className="h-3 w-3 flex-shrink-0" />
          <span>v{health.data?.version ?? '0.1.0'}</span>
        </a>
      </div>

      {/* User widget + popover */}
      <div className="relative border-t border-slate-200 dark:border-dark-600" ref={menuRef}>
        {/* Popover — opens upward */}
        {menuOpen && (
          <div className="absolute bottom-full left-2 right-2 mb-1 rounded-lg border border-slate-200 dark:border-dark-600 bg-white dark:bg-dark-900 shadow-popover z-50 overflow-hidden">
            {/* Appearance */}
            <div className="px-3 py-2.5 flex items-center justify-between border-b border-slate-100 dark:border-dark-700">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Appearance</span>
              <button
                onClick={() => setDark(!dark)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-dark-700 text-xs font-medium transition-colors"
              >
                {dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                {dark ? 'Light' : 'Dark'}
              </button>
            </div>

            {/* Nav links */}
            <div className="py-1">
              <button
                onClick={() => { setMenuOpen(false); onNavigate('profile'); }}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-dark-800 transition-colors"
              >
                <User className="h-4 w-4 text-slate-400 flex-shrink-0" />
                Profile &amp; Keys
              </button>
              {isAdmin && (
                <button
                  onClick={() => { setMenuOpen(false); onNavigate('settings'); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-dark-800 transition-colors"
                >
                  <Shield className="h-4 w-4 text-slate-400 flex-shrink-0" />
                  Settings
                </button>
              )}
            </div>

            <div className="border-t border-slate-100 dark:border-dark-700 py-1">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <LogOut className="h-4 w-4 flex-shrink-0" />
                Sign out
              </button>
            </div>
          </div>
        )}

        {/* Trigger */}
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-200 dark:hover:bg-dark-700 transition-colors"
        >
          <div className="h-8 w-8 rounded-full bg-cyan-600 dark:bg-cyan-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
              {user?.displayName || user?.email || 'User'}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 truncate">
              {ROLE_LABELS[user?.role ?? ''] ?? user?.role ?? ''}
            </p>
          </div>
          <ChevronUp
            className={cn(
              'h-3.5 w-3.5 text-slate-400 flex-shrink-0 transition-transform duration-200',
              menuOpen ? '' : 'rotate-180',
            )}
          />
        </button>
      </div>
    </nav>
  );
}
