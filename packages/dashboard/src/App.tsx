import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { Sidebar } from '@/components/layout/Sidebar';
import { DashboardPage } from '@/pages/DashboardPage';
import { SessionsPage } from '@/pages/SessionsPage';
import { ProjectsPage } from '@/pages/ProjectsPage';
import { LoginPage } from '@/pages/LoginPage';
import { AcceptInvitePage } from '@/pages/AcceptInvitePage';
import { SetupPage } from '@/pages/SetupPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { AdminOrgPage } from '@/pages/AdminOrgPage';
import { AdminTeamPage } from '@/pages/AdminTeamPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { DeveloperDetailPage } from '@/pages/DeveloperDetailPage';
import { HelpPage } from '@/pages/HelpPage';
import { getToken, getUser } from '@/api/client';
import { useQueryClient } from '@tanstack/react-query';

export type InnerPage = 'dashboard' | 'sessions' | 'projects' | 'profile' | 'admin-org' | 'admin-team' | 'settings' | 'developer-detail' | 'help';

const PAGE_LABELS: Record<InnerPage, string> = {
  dashboard: 'DASHBOARD',
  sessions: 'SESSIONS',
  projects: 'PROJECTS',
  profile: 'PROFILE',
  'admin-org': 'OVERVIEW',
  'admin-team': 'TEAM',
  settings: 'SETTINGS',
  'developer-detail': 'DEVELOPER',
  help: 'HELP',
};

function isAuthenticated(): boolean {
  return !!getToken() && !!getUser();
}

const PUBLIC_PATHS = ['/login', '/invite/accept', '/setup'];

function pathnameToPage(pathname: string): InnerPage | null {
  if (pathname === '/profile') return 'profile';
  if (pathname === '/sessions') return 'sessions';
  if (pathname === '/projects') return 'projects';
  if (pathname === '/admin/org') return 'admin-org';
  if (pathname === '/admin/team') return 'admin-team';
  if (pathname === '/admin/settings') return 'settings';
  if (pathname.startsWith('/admin/developer/')) return 'developer-detail';
  if (pathname === '/help') return 'help';
  return null;
}

export default function App() {
  const [pathname, setPathname] = useState(window.location.pathname);
  const [activePage, setActivePage] = useState<InnerPage>(
    () => pathnameToPage(window.location.pathname) ?? 'dashboard',
  );
  const [selectedDeveloperId, setSelectedDeveloperId] = useState<string | null>(null);
  const [selectedDeveloperName, setSelectedDeveloperName] = useState<string>('');
  const queryClient = useQueryClient();

  useEffect(() => {
    const handler = () => {
      const p = window.location.pathname;
      setPathname(p);
      const page = pathnameToPage(p);
      if (page) setActivePage(page);
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);

  const authed = isAuthenticated();

  if (pathname === '/login') return <LoginPage />;
  if (pathname.startsWith('/invite/accept')) return <AcceptInvitePage />;
  if (pathname === '/setup') return <SetupPage />;

  if (!authed && !PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    window.location.replace('/login');
    return null;
  }

  const currentPage = activePage;

  const pathMap: Record<InnerPage, string> = {
    dashboard: '/',
    sessions: '/sessions',
    projects: '/projects',
    profile: '/profile',
    'admin-org': '/admin/org',
    'admin-team': '/admin/team',
    settings: '/admin/settings',
    'developer-detail': selectedDeveloperId ? `/admin/developer/${selectedDeveloperId}` : '/admin/org',
    help: '/help',
  };

  function navigate(page: InnerPage) {
    setActivePage(page);
    setPathname(pathMap[page]);
    window.history.pushState({}, '', pathMap[page]);
  }

  function handleSelectDeveloper(developerId: string, displayName: string) {
    setSelectedDeveloperId(developerId);
    setSelectedDeveloperName(displayName);
    setActivePage('developer-detail');
    const path = `/admin/developer/${developerId}`;
    setPathname(path);
    window.history.pushState({}, '', path);
  }

  function handleBackFromDeveloper() {
    setSelectedDeveloperId(null);
    navigate('admin-org');
  }

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar activePage={currentPage} onNavigate={navigate} />

      <main className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div
          className="flex items-center justify-between gap-4 px-7 border-b border-line sticky top-0 z-50"
          style={{
            padding: '14px 28px',
            background: 'color-mix(in oklch, var(--bg) 92%, transparent)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div className="mono text-[11px] text-ink-3" style={{ letterSpacing: '0.05em' }}>
            ACME · DEV&nbsp;&nbsp;/&nbsp;&nbsp;
            <span className="text-ink">{PAGE_LABELS[currentPage]}</span>
          </div>

          <button
            onClick={() => queryClient.invalidateQueries()}
            title="Refresh"
            className="p-[7px] border border-line bg-surface rounded-btn cursor-pointer text-ink-2 grid place-items-center hover:bg-canvas-alt transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Page content */}
        <div className="px-8 pt-7 pb-12 max-w-[1400px] w-full mx-auto">
          {currentPage === 'dashboard' && <DashboardPage />}
          {currentPage === 'sessions' && <SessionsPage />}
          {currentPage === 'projects' && <ProjectsPage />}
          {currentPage === 'profile' && <ProfilePage />}
          {currentPage === 'admin-org' && (
            <AdminOrgPage onSelectDeveloper={handleSelectDeveloper} />
          )}
          {currentPage === 'admin-team' && <AdminTeamPage />}
          {currentPage === 'settings' && <SettingsPage />}
          {currentPage === 'help' && <HelpPage />}
          {currentPage === 'developer-detail' && selectedDeveloperId && (
            <DeveloperDetailPage
              developerId={selectedDeveloperId}
              displayName={selectedDeveloperName}
              onBack={handleBackFromDeveloper}
            />
          )}
        </div>
      </main>
    </div>
  );
}
