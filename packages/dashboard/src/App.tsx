import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { DashboardPage } from '@/pages/DashboardPage';
import { SessionsPage } from '@/pages/SessionsPage';
import { ProjectsPage } from '@/pages/ProjectsPage';

type Page = 'dashboard' | 'sessions' | 'projects';

export default function App() {
  const [activePage, setActivePage] = useState<Page>('dashboard');

  return (
    <div className="h-screen flex flex-col bg-slate-50 dark:bg-dark-950">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar activePage={activePage} onNavigate={setActivePage} />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-[1280px] mx-auto">
            {activePage === 'dashboard' && <DashboardPage />}
            {activePage === 'sessions' && <SessionsPage />}
            {activePage === 'projects' && <ProjectsPage />}
          </div>
        </main>
      </div>
    </div>
  );
}
