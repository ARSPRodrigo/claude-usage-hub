import { BarChart3, FolderOpen, Clock, Github, Database, RefreshCw, User, Users, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHealth } from '@/api/hooks';
import { getUser } from '@/api/client';

type Page = 'dashboard' | 'sessions' | 'projects' | 'profile' | 'admin-org' | 'admin-team';

const navItems: { id: Page; label: string; icon: typeof BarChart3; adminOnly?: boolean }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'projects', label: 'Projects', icon: FolderOpen },
  { id: 'sessions', label: 'Sessions', icon: Clock },
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'admin-org', label: 'Org Overview', icon: Building2, adminOnly: true },
  { id: 'admin-team', label: 'Team', icon: Users, adminOnly: true },
];

interface SidebarProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
}

export function Sidebar({ activePage, onNavigate }: SidebarProps) {
  const health = useHealth();
  const user = getUser();
  const isAdmin = user?.role === 'admin';
  const visibleItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  return (
    <nav className="w-52 border-r border-slate-200 dark:border-dark-600 bg-slate-100 dark:bg-dark-900 flex flex-col flex-shrink-0">
      {/* Navigation */}
      <ul className="space-y-1 px-3 py-4 flex-1">
        {visibleItems.map(({ id, label, icon: Icon }) => (
          <li key={id}>
            <button
              onClick={() => onNavigate(id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                activePage === id
                  ? 'bg-cyan-100 dark:bg-cyan-900/15 text-cyan-700 dark:text-cyan-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-dark-700 hover:text-slate-800 dark:hover:text-slate-200',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          </li>
        ))}
      </ul>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-slate-200 dark:border-dark-600 space-y-3">
        {/* DB status */}
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-500">
          <Database className="h-3 w-3" />
          <span>
            {health.data
              ? `${health.data.entryCount.toLocaleString()} entries`
              : '...'}
          </span>
        </div>

        {/* Last collected */}
        {health.data?.lastEntry && (
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-500">
            <RefreshCw className="h-3 w-3" />
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

        {/* GitHub link */}
        <a
          href="https://github.com/ARSPRodrigo/claude-usage-hub"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
        >
          <Github className="h-3 w-3" />
          <span>v{health.data?.version ?? '0.1.0'}</span>
        </a>
      </div>
    </nav>
  );
}
