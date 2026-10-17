import React, { useEffect, useState } from 'react';
import { LogOut, Settings } from 'lucide-react';
import { StudyDuelLogo } from '../Logo/StudyDuelLogo';
import { ThemeToggle } from '../Header/ThemeToggle';
import { DemoTimerPanel } from './sections/DemoTimerPanel';
import { DemoDuelPanel } from './sections/DemoDuelPanel';
import { DemoProductivityPanel } from './sections/DemoProductivityPanel';
import { DemoClock } from './sections/DemoClock';
import { DemoManagePanel } from './sections/DemoManagePanel';
import { DemoSettingsPage } from './sections/DemoSettingsPage';
import './GuestDashboard.css';

const pages = [
  { id: 'timer', label: 'Timer' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'comparison', label: 'Comparison stats' },
  { id: 'manage', label: 'Manage' },
];

export const GuestDashboard = ({ user, onExitGuest }) => {
  const [activePage, setActivePage] = useState('timer');
  const [isSettings, setIsSettings] = useState(() => window.location.pathname === '/settings');

  useEffect(() => {
    const handlePopState = () => setIsSettings(window.location.pathname === '/settings');
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const openSettings = () => {
    window.history.pushState({}, '', '/settings');
    setIsSettings(true);
  };

  const closeSettings = () => {
    window.history.pushState({}, '', '/');
    setIsSettings(false);
  };

  const logout = () => {
    window.history.replaceState({}, '', '/');
    onExitGuest();
  };

  return <div className="guest-dashboard-wrapper">
    <nav className="dashboard-nav" aria-label="Demo dashboard">
      <div className="nav-left">
        <StudyDuelLogo size="medium" />
        {!isSettings && <span className="demo-mode-pill">{user ? user.display_name : 'Guest'}</span>}
      </div>

      {!isSettings && <div className="dashboard-tabs" role="tablist" aria-label="Dashboard pages">
        {pages.map(({ id, label }) => (
          <button
            type="button"
            role="tab"
            id={`demo-tab-${id}`}
            aria-selected={activePage === id}
            aria-controls={`demo-page-${id}`}
            className={`dashboard-tab${activePage === id ? ' active' : ''}`}
            key={id}
            onClick={() => setActivePage(id)}
          >
            {label}
          </button>
        ))}
      </div>}

      <div className="nav-right">
        <ThemeToggle />

        <button type="button" className="dashboard-icon-btn" onClick={openSettings} aria-label="Open settings" title="Settings">
          <Settings size={17} />
        </button>

        <button
          type="button"
          className="exit-demo-btn"
          onClick={logout}
          title="Log out"
        >
          <LogOut size={16} />
          <span>Log out</span>
        </button>
      </div>
    </nav>

    <main className="dashboard-content" id={isSettings ? 'settings-page' : `demo-page-${activePage}`} role={isSettings ? undefined : 'tabpanel'} aria-labelledby={isSettings ? undefined : `demo-tab-${activePage}`}>
      {isSettings ? <DemoSettingsPage onBack={closeSettings} /> : <>
        {activePage === 'timer' && <><DemoClock /><DemoTimerPanel /></>}
        {activePage === 'dashboard' && <DemoProductivityPanel />}
        {activePage === 'comparison' && <DemoDuelPanel />}
        {activePage === 'manage' && <DemoManagePanel />}
      </>}
    </main>
  </div>;
};
