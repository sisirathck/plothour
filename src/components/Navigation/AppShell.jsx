import React, { useEffect, useState } from 'react';
import { LogOut, Settings } from 'lucide-react';
import { StudyDuelLogo } from '../Logo/StudyDuelLogo';
import { ThemeToggle } from '../Header/ThemeToggle';
import { TimerPage } from '../../modules/timer/TimerPage';
import { DashboardPage } from '../../modules/dashboard/DashboardPage';
import { ComparePage } from '../../modules/compare/ComparePage';
import { ManagePage } from '../../modules/manage/ManagePage';
import { SettingsPage } from '../../modules/settings/SettingsPage';
import './AppShell.css';

const navItems = [
  { route: 'timer', path: '/timer', label: 'Timer' },
  { route: 'dashboard', path: '/dashboard', label: 'Dashboard' },
  { route: 'compare', path: '/compare', label: 'Compare' },
  { route: 'manage', path: '/manage', label: 'Manage' },
];

const getRouteFromPath = () => {
  const clean = window.location.pathname.toLowerCase().replace(/^\/+/, '').split('/')[0];
  if (['timer', 'dashboard', 'compare', 'manage', 'settings'].includes(clean)) {
    return clean;
  }
  return 'timer';
};

export const AppShell = ({ user, onLogout }) => {
  const [currentRoute, setCurrentRoute] = useState(getRouteFromPath);

  useEffect(() => {
    // Sync URL if root or unmatched
    const route = getRouteFromPath();
    if (window.location.pathname !== `/${route}`) {
      window.history.replaceState({}, '', `/${route}`);
    }

    const handlePopState = () => {
      setCurrentRoute(getRouteFromPath());
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (route) => {
    window.history.pushState({}, '', `/${route}`);
    setCurrentRoute(route);
  };

  const isSettings = currentRoute === 'settings';

  return (
    <div className="app-shell-wrapper">
      {/* Persistent Top Navigation Bar */}
      <nav className="dashboard-nav" aria-label="StudyDuel main navigation">
        <div className="nav-left">
          <button
            type="button"
            onClick={() => navigateTo('timer')}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            aria-label="Go to Timer"
          >
            <StudyDuelLogo size="medium" />
          </button>
          {!isSettings && (
            <span className="demo-mode-pill">
              {user ? user.display_name : 'Guest'}
            </span>
          )}
        </div>

        {/* 4 Primary Navigation Tabs: /timer, /dashboard, /compare, /manage */}
        {!isSettings && (
          <div className="dashboard-tabs" role="tablist" aria-label="Application sections">
            {navItems.map(({ route, label }) => {
              const isActive = currentRoute === route;
              return (
                <button
                  key={route}
                  type="button"
                  role="tab"
                  id={`tab-${route}`}
                  aria-selected={isActive}
                  aria-controls={`panel-${route}`}
                  className={`dashboard-tab${isActive ? ' active' : ''}`}
                  onClick={() => navigateTo(route)}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {/* Right Action Controls: Theme, Settings, Log out */}
        <div className="nav-right">
          <ThemeToggle />

          <button
            type="button"
            className={`dashboard-icon-btn ${isSettings ? 'active' : ''}`}
            onClick={() => navigateTo(isSettings ? 'timer' : 'settings')}
            aria-label="Settings"
            title="Settings"
          >
            <Settings size={18} />
          </button>

          <button
            type="button"
            className="exit-demo-btn"
            onClick={onLogout}
            title={user ? 'Log out' : 'Exit demo'}
          >
            <LogOut size={16} />
            <span>{user ? 'Log out' : 'Exit demo'}</span>
          </button>
        </div>
      </nav>

      {/* Modular Section Content */}
      <main className="app-shell-content" id={`panel-${currentRoute}`} role="region">
        {currentRoute === 'timer' && <TimerPage user={user} onNavigate={navigateTo} />}
        {currentRoute === 'dashboard' && <DashboardPage user={user} onNavigate={navigateTo} />}
        {currentRoute === 'compare' && <ComparePage user={user} onNavigate={navigateTo} />}
        {currentRoute === 'manage' && <ManagePage user={user} />}
        {currentRoute === 'settings' && (
          <SettingsPage user={user} onBack={() => navigateTo('timer')} />
        )}
      </main>
    </div>
  );
};
