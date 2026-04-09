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
    <nav className="w-52 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 py-4 flex-shrink-0">
      <ul className="space-y-1 px-3">
        {navItems.map(({ id, label, icon: Icon }) => (
          <li key={id}>
            <button
              onClick={() => onNavigate(id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                activePage === id
                  ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-800 dark:hover:text-zinc-200',
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
