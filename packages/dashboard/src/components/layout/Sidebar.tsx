import {
  BarChart3, FolderOpen, Clock, Building2, Users,
  ChevronUp, User, Settings, LogOut, Sun, Moon,
  Gauge, HelpCircle,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { useHealth } from '@/api/hooks';
import { getUser, clearAuth } from '@/api/client';

type Page = 'dashboard' | 'sessions' | 'projects' | 'profile' | 'admin-org' | 'admin-team' | 'settings' | 'developer-detail' | 'help';

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
            'w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-btn text-[13.5px] font-medium transition-all duration-[120ms]',
            isActive
              ? 'bg-ink text-canvas'
              : 'text-ink-2 hover:bg-canvas-alt',
          )}
          style={{ letterSpacing: '-0.005em' }}
        >
          <Icon className="h-[15px] w-[15px] flex-shrink-0" />
          {label}
        </button>
      </li>
    );
  }

  return (
    <nav
      className="w-[216px] border-r border-line bg-canvas-alt flex flex-col flex-shrink-0 sticky top-0 h-screen"
    >
      {/* Brand */}
      <div className="px-4 pt-4.5 pb-4 flex items-center gap-2.5">
        <div className="w-[26px] h-[26px] rounded-btn bg-ink text-canvas grid place-items-center flex-shrink-0">
          <Gauge className="h-3.5 w-3.5" />
        </div>
        <div className="leading-tight">
          <div className="text-[13.5px] font-semibold" style={{ letterSpacing: '-0.01em' }}>
            Usage Hub
          </div>
          <div className="label mt-0.5" style={{ fontSize: '9.5px' }}>
            v{health.data?.version ?? '0.2.0'} · BETA
          </div>
        </div>
      </div>

      {/* Navigation sections */}
      <div className="flex-1 overflow-y-auto px-3 pt-1">
        <div className="label px-1.5 pt-3.5 pb-1.5">My Usage</div>
        <ul className="flex flex-col gap-0.5">
          <NavItem id="dashboard" label="Dashboard" icon={BarChart3} />
          <NavItem id="projects" label="Projects" icon={FolderOpen} />
          <NavItem id="sessions" label="Sessions" icon={Clock} />
        </ul>

        {isAdmin && (
          <>
            <div className="label px-1.5 pt-4.5 pb-1.5">Organization</div>
            <ul className="flex flex-col gap-0.5">
              <NavItem id="admin-org" label="Overview" icon={Building2} extraActive="developer-detail" />
              <NavItem id="admin-team" label="Team" icon={Users} />
            </ul>
          </>
        )}
      </div>

      {/* Live status block */}
      <div className="px-3.5 py-2.5 border-t border-line text-[11px]">
        <div className="flex items-center gap-2 text-ink-3">
          <span
            className="w-[7px] h-[7px] rounded-full bg-pos flex-shrink-0"
            style={{ boxShadow: '0 0 0 3px color-mix(in oklch, var(--pos) 22%, transparent)' }}
          />
          <span className="mono" style={{ fontSize: '10.5px', letterSpacing: '0.04em' }}>
            LIVE · {health.data?.entryCount?.toLocaleString() ?? '…'} entries
          </span>
        </div>
        {health.data?.lastEntry && (
          <div className="mono text-ink-4 mt-1.5" style={{ fontSize: '10px' }}>
            sync {new Date(health.data.lastEntry).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
      </div>

      {/* User widget + popover */}
      <div className="relative border-t border-line px-3 py-2.5" ref={menuRef}>
        {menuOpen && (
          <div
            className="absolute bottom-[calc(100%+4px)] left-2.5 right-2.5 bg-surface border border-line rounded-card shadow-popover overflow-hidden z-50"
          >
            {/* Appearance */}
            <div className="px-3 py-2.5 flex items-center justify-between border-b border-line-2">
              <span className="label">Appearance</span>
              <button
                onClick={() => setDark(!dark)}
                className="inline-flex items-center gap-1.5 px-2 py-1 bg-canvas-alt border border-line rounded-btn cursor-pointer text-[11px] font-medium text-ink-2"
              >
                {dark ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
                {dark ? 'Light' : 'Dark'}
              </button>
            </div>

            {/* Menu links */}
            {[
              { id: 'profile' as Page, label: 'Profile & keys', Icon: User },
              { id: 'help' as Page, label: 'Help & docs', Icon: HelpCircle },
              ...(isAdmin ? [{ id: 'settings' as Page, label: 'Settings', Icon: Settings }] : []),
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => { setMenuOpen(false); onNavigate(item.id); }}
                className="flex items-center gap-2.5 w-full px-3 py-2.5 text-[13px] text-ink hover:bg-canvas-alt transition-colors"
              >
                <item.Icon className="h-3.5 w-3.5 text-ink-3" />
                {item.label}
              </button>
            ))}

            <div className="border-t border-line-2">
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2.5 w-full px-3 py-2.5 text-[13px] text-neg hover:bg-[color-mix(in_oklch,var(--neg)_8%,transparent)] transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            </div>
          </div>
        )}

        {/* Trigger */}
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="flex items-center gap-2.5 w-full px-1.5 py-1.5 rounded-btn text-ink"
        >
          <div
            className="w-7 h-7 rounded-full flex-shrink-0 text-white grid place-items-center text-[11px] font-semibold"
            style={{ background: 'linear-gradient(135deg, var(--accent) 0%, oklch(0.55 0.15 30) 100%)' }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="text-[12.5px] font-medium truncate">
              {user?.displayName || user?.email || 'User'}
            </div>
            <div className="mono text-ink-3 mt-px" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {ROLE_LABELS[user?.role ?? ''] ?? user?.role ?? ''}
            </div>
          </div>
          <ChevronUp
            className={cn(
              'h-3.5 w-3.5 text-ink-3 flex-shrink-0 transition-transform duration-150',
              menuOpen ? '' : 'rotate-180',
            )}
          />
        </button>
      </div>
    </nav>
  );
}
