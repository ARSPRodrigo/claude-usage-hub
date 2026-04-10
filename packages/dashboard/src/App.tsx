import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { DashboardPage } from '@/pages/DashboardPage';
import { SessionsPage } from '@/pages/SessionsPage';
import { ProjectsPage } from '@/pages/ProjectsPage';
import { LoginPage } from '@/pages/LoginPage';
import { AcceptInvitePage } from '@/pages/AcceptInvitePage';
import { SetupPage } from '@/pages/SetupPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { getToken, getUser } from '@/api/client';

type InnerPage = 'dashboard' | 'sessions' | 'projects' | 'profile';

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

// Public routes — accessible without auth
const PUBLIC_PATHS = ['/login', '/invite/accept', '/setup'];

export default function App() {
  const pathname = usePathname();
  const [activePage, setActivePage] = useState<InnerPage>('dashboard');

  const authed = isAuthenticated();

  // Route: public pages
  if (pathname === '/login') return <LoginPage />;
  if (pathname.startsWith('/invite/accept')) return <AcceptInvitePage />;
  if (pathname === '/setup') return <SetupPage />;

  // Route: protected pages — redirect to login if not authed
  if (!authed && !PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    // Use effect-free redirect (render nothing, browser redirects)
    window.location.replace('/login');
    return null;
  }

  const currentPage: InnerPage =
    pathname === '/profile' ? 'profile' :
    pathname === '/sessions' ? 'sessions' :
    pathname === '/projects' ? 'projects' :
    activePage;

  function navigate(page: InnerPage) {
    setActivePage(page);
    const path = page === 'dashboard' ? '/' : `/${page}`;
    window.history.pushState({}, '', path);
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50 dark:bg-dark-950">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar activePage={currentPage} onNavigate={navigate} />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-[1280px] mx-auto">
            {currentPage === 'dashboard' && <DashboardPage />}
            {currentPage === 'sessions' && <SessionsPage />}
            {currentPage === 'projects' && <ProjectsPage />}
            {currentPage === 'profile' && <ProfilePage />}
          </div>
        </main>
      </div>
    </div>
  );
}
