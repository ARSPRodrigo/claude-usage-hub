import { BarChart3, Clock, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

type Page = 'dashboard' | 'sessions' | 'projects';

const navItems: { id: Page; label: string; icon: typeof BarChart3 }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'sessions', label: 'Sessions', icon: Clock },
  { id: 'projects', label: 'Projects', icon: FolderOpen },
];

interface SidebarProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
}

export function Sidebar({ activePage, onNavigate }: SidebarProps) {
  return (
    <nav className="w-52 border-r border-slate-200 dark:border-dark-600 bg-slate-100 dark:bg-dark-900 py-4 flex-shrink-0">
      <ul className="space-y-1 px-3">
        {navItems.map(({ id, label, icon: Icon }) => (
          <li key={id}>
            <button
              onClick={() => onNavigate(id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                activePage === id
                  ? 'bg-cyan-50 dark:bg-cyan-900/15 text-cyan-700 dark:text-cyan-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-dark-700 hover:text-slate-800 dark:hover:text-slate-200',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
