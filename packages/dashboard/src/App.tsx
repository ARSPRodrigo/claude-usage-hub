import { useState, useEffect } from 'react';
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
import { getToken, getUser } from '@/api/client';

export type InnerPage = 'dashboard' | 'sessions' | 'projects' | 'profile' | 'admin-org' | 'admin-team' | 'settings' | 'developer-detail';

function usePathname(): string {
  const [pathname, setPathname] = useState(window.location.pathname);
  useEffect(() => {
    const handler = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);
  return pathname;
}

function isAuthenticated(): boolean {
  return !!getToken() && !!getUser();
}

const PUBLIC_PATHS = ['/login', '/invite/accept', '/setup'];

export default function App() {
  const pathname = usePathname();
  const [activePage, setActivePage] = useState<InnerPage>('dashboard');
  const [selectedDeveloperId, setSelectedDeveloperId] = useState<string | null>(null);
  const [selectedDeveloperName, setSelectedDeveloperName] = useState<string>('');

  const authed = isAuthenticated();

  if (pathname === '/login') return <LoginPage />;
  if (pathname.startsWith('/invite/accept')) return <AcceptInvitePage />;
  if (pathname === '/setup') return <SetupPage />;

  if (!authed && !PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    window.location.replace('/login');
    return null;
  }

  const currentPage: InnerPage =
    pathname === '/profile' ? 'profile' :
    pathname === '/sessions' ? 'sessions' :
    pathname === '/projects' ? 'projects' :
    pathname === '/admin/org' ? 'admin-org' :
    pathname === '/admin/team' ? 'admin-team' :
    pathname === '/admin/settings' ? 'settings' :
    pathname.startsWith('/admin/developer/') ? 'developer-detail' :
    activePage;

  const pathMap: Record<InnerPage, string> = {
    dashboard: '/',
    sessions: '/sessions',
    projects: '/projects',
    profile: '/profile',
    'admin-org': '/admin/org',
    'admin-team': '/admin/team',
    settings: '/admin/settings',
    'developer-detail': selectedDeveloperId ? `/admin/developer/${selectedDeveloperId}` : '/admin/org',
  };

  function navigate(page: InnerPage) {
    setActivePage(page);
    window.history.pushState({}, '', pathMap[page]);
  }

  function handleSelectDeveloper(developerId: string, displayName: string) {
    setSelectedDeveloperId(developerId);
    setSelectedDeveloperName(displayName);
    setActivePage('developer-detail');
    window.history.pushState({}, '', `/admin/developer/${developerId}`);
  }

  function handleBackFromDeveloper() {
    setSelectedDeveloperId(null);
    navigate('admin-org');
  }

  return (
    <div className="h-screen flex bg-slate-50 dark:bg-dark-950">
      <Sidebar activePage={currentPage} onNavigate={navigate} />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-[1280px] mx-auto">
          {currentPage === 'dashboard' && <DashboardPage />}
          {currentPage === 'sessions' && <SessionsPage />}
          {currentPage === 'projects' && <ProjectsPage />}
          {currentPage === 'profile' && <ProfilePage />}
          {currentPage === 'admin-org' && (
            <AdminOrgPage onSelectDeveloper={handleSelectDeveloper} />
          )}
          {currentPage === 'admin-team' && <AdminTeamPage />}
          {currentPage === 'settings' && <SettingsPage />}
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
