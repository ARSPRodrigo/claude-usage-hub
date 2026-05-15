import { useState, useEffect } from 'react';
import { RefreshCw, Sun, Moon } from 'lucide-react';
import { Sidebar } from '@/components/layout/Sidebar';
import { OrgSwitcher } from '@/components/layout/OrgSwitcher';
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
import { CostComparisonPage } from '@/pages/CostComparisonPage';
import { ManagePage } from '@/pages/ManagePage';
import { apiGet, getToken, getUser, setUser } from '@/api/client';
import { useQueryClient } from '@tanstack/react-query';

export type InnerPage =
  | 'dashboard' | 'sessions' | 'projects' | 'cost-comparison' | 'profile'
  | 'admin-org' | 'admin-team' | 'admin-cost-comparison'
  | 'manage-organizations' | 'manage-workspaces' | 'manage-members' | 'manage-audit' | 'manage-domain-rules'
  | 'settings' | 'developer-detail' | 'help';

const PAGE_LABELS: Record<InnerPage, string> = {
  dashboard: 'DASHBOARD',
  sessions: 'SESSIONS',
  projects: 'PROJECTS',
  profile: 'PROFILE',
  'admin-org': 'OVERVIEW',
  'admin-team': 'TEAM',
  settings: 'SETTINGS',
  'cost-comparison': 'COST COMPARISON',
  'admin-cost-comparison': 'COST COMPARISON',
  'manage-organizations': 'ORGANIZATIONS',
  'manage-workspaces': 'WORKSPACES',
  'manage-members': 'MEMBERS',
  'manage-audit': 'AUDIT LOG',
  'manage-domain-rules': 'DOMAIN RULES',
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
  if (pathname === '/cost-comparison') return 'cost-comparison';
  if (pathname === '/admin/cost-comparison') return 'admin-cost-comparison';
  if (pathname === '/manage/organizations') return 'manage-organizations';
  if (pathname === '/manage/workspaces') return 'manage-workspaces';
  if (pathname === '/manage/members') return 'manage-members';
  if (pathname === '/manage/audit') return 'manage-audit';
  if (pathname === '/manage/domain-rules') return 'manage-domain-rules';
  // Legacy alias from before the Manage split — redirect target.
  if (pathname === '/admin/manage') return 'manage-organizations';
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

  // Refresh role/displayName/ownership from the server on mount so legacy
  // values (e.g. primary_owner cached in localStorage) get the canonical
  // platform_* values and ownership grants land in localStorage without
  // forcing a re-login. Also re-fetches every 5 minutes so promote/demote
  // / grant changes take effect without a manual reload.
  useEffect(() => {
    function refresh() {
      if (!getToken() || !getUser()) return;
      apiGet<{
        id: string; email: string; displayName: string; role: string;
        developerId: string; ownedOrgIds?: string[]; ownedWorkspaceIds?: string[];
      }>('/auth/me')
        .then((fresh) => {
          const current = getUser();
          if (!current) return;
          const ownedOrgIds = fresh.ownedOrgIds ?? [];
          const ownedWorkspaceIds = fresh.ownedWorkspaceIds ?? [];
          const changed =
            current.role !== fresh.role ||
            current.displayName !== fresh.displayName ||
            JSON.stringify(current.ownedOrgIds ?? []) !== JSON.stringify(ownedOrgIds) ||
            JSON.stringify(current.ownedWorkspaceIds ?? []) !== JSON.stringify(ownedWorkspaceIds);
          if (changed) {
            setUser({
              ...current,
              role: fresh.role as typeof current.role,
              displayName: fresh.displayName,
              ownedOrgIds,
              ownedWorkspaceIds,
            });
            setPathname((p) => p);
          }
        })
        .catch(() => { /* ignore — 401 is handled by apiGet */ });
    }
    refresh();
    const id = setInterval(refresh, 5 * 60_000);
    return () => clearInterval(id);
  }, []);

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
    'cost-comparison': '/cost-comparison',
    'admin-cost-comparison': '/admin/cost-comparison',
    'manage-organizations': '/manage/organizations',
    'manage-workspaces': '/manage/workspaces',
    'manage-members': '/manage/members',
    'manage-audit': '/manage/audit',
    'manage-domain-rules': '/manage/domain-rules',
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
      <Sidebar activePage={currentPage} onNavigate={navigate} dark={dark} setDark={setDark} />

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
          <div className="mono text-[11px] text-ink" style={{ letterSpacing: '0.05em' }}>
            {PAGE_LABELS[currentPage]}
          </div>

          <div className="flex items-center gap-2">
            <OrgSwitcher />
            <button
              onClick={() => queryClient.invalidateQueries()}
              title="Refresh"
              className="p-[7px] border border-line bg-surface rounded-btn cursor-pointer text-ink-2 grid place-items-center hover:bg-canvas-alt transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setDark(!dark)}
              title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="p-[7px] border border-line bg-surface rounded-btn cursor-pointer text-ink-2 grid place-items-center hover:bg-canvas-alt transition-colors"
            >
              {dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* Page content */}
        <div className="px-8 pt-7 pb-12 max-w-[1400px] w-full mx-auto">
          {currentPage === 'dashboard' && <DashboardPage />}
          {currentPage === 'sessions' && <SessionsPage />}
          {currentPage === 'projects' && <ProjectsPage />}
          {currentPage === 'cost-comparison' && <CostComparisonPage />}
          {currentPage === 'admin-cost-comparison' && <CostComparisonPage orgWide />}
          {currentPage === 'manage-organizations' && <ManagePage section="orgs" />}
          {currentPage === 'manage-workspaces' && <ManagePage section="workspaces" />}
          {currentPage === 'manage-members' && <ManagePage section="members" />}
          {currentPage === 'manage-audit' && <ManagePage section="audit" />}
          {currentPage === 'manage-domain-rules' && <ManagePage section="domain-rules" />}
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
