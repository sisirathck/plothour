import React, { useEffect, useState } from 'react';
import { LogOut, Settings, Square, Timer } from 'lucide-react';
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

const readLocalValue = (key, fallback = null) => {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback;
  } catch {
    return fallback;
  }
};

const formatRunningTime = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return [hours, minutes, remainder].map((part) => String(part).padStart(2, '0')).join(':');
};

export const AppShell = ({ user, onLogout }) => {
  const [currentRoute, setCurrentRoute] = useState(getRouteFromPath);
  const activeTimerKey = user?.id
    ? `studyduel_user_${user.id}_active_timer`
    : 'studyduel_demo_active_timer';
  const entriesKey = user?.id
    ? `studyduel_user_${user.id}_time_entries`
    : 'studyduel_demo_time_entries';
  const [activeTimer, setActiveTimer] = useState(() => readLocalValue(activeTimerKey));
  const [timerNow, setTimerNow] = useState(Date.now());

  useEffect(() => {
    const syncTimer = () => setActiveTimer(readLocalValue(activeTimerKey));
    syncTimer();
    const interval = window.setInterval(() => {
      syncTimer();
      setTimerNow(Date.now());
    }, 1000);
    window.addEventListener('storage', syncTimer);
    window.addEventListener('studyduel:timer-storage', syncTimer);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('storage', syncTimer);
      window.removeEventListener('studyduel:timer-storage', syncTimer);
    };
  }, [activeTimerKey]);

  const stopRunningTimer = () => {
    if (!activeTimer) return;
    const endedAt = Date.now();
    const durationSeconds = Math.max(1, Math.floor((endedAt - activeTimer.startedAt) / 1000));
    const savedEntries = readLocalValue(entriesKey, []);
    const completedEntry = {
      id: crypto.randomUUID(),
      ...activeTimer,
      endedAt,
      durationSeconds,
    };
    localStorage.setItem(entriesKey, JSON.stringify([
      completedEntry,
      ...(Array.isArray(savedEntries) ? savedEntries : []),
    ]));
    localStorage.setItem(activeTimerKey, 'null');
    setActiveTimer(null);
    window.dispatchEvent(new CustomEvent('studyduel:timer-storage', {
      detail: { activeTimerKey, entriesKey },
    }));
  };

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
          {activeTimer && (
            <div className="running-session-island" role="status" aria-live="off">
              <span className="running-session-icon" aria-hidden="true"><Timer size={15} /></span>
              <span className="running-session-context">
                <span className="running-session-project">{activeTimer.projectName || 'Study session'}</span>
                {activeTimer.subjectName && (
                  <span className="running-session-subject">{activeTimer.subjectName}</span>
                )}
              </span>
              <span className="running-session-time">
                {formatRunningTime(Math.max(0, Math.floor((timerNow - activeTimer.startedAt) / 1000)))}
              </span>
              <button
                type="button"
                className="running-session-stop"
                onClick={stopRunningTimer}
                aria-label={`Stop ${activeTimer.projectName || 'study'} session`}
                title="Stop and save session"
              >
                <Square size={11} fill="currentColor" />
              </button>
            </div>
          )}
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
