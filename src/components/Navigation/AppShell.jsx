import React, { useEffect, useLayoutEffect, useState } from 'react';
import { Bell, Flame, LogOut, Settings, Square, X } from 'lucide-react';
import { StudyDuelLogo } from '../Logo/StudyDuelLogo';
import { TimerPage } from '../../modules/timer/TimerPage';
import { DashboardPage } from '../../modules/dashboard/DashboardPage';
import { ComparePage } from '../../modules/compare/ComparePage';
import { ManagePage } from '../../modules/manage/ManagePage';
import { SettingsPage } from '../../modules/settings/SettingsPage';
import { CalendarPage } from '../../modules/calendar/CalendarPage';
import { AdminPage } from '../../modules/admin/AdminPage';
import { formatDisplayDate } from '../../utils/dateFormat';
import './AppShell.css';

const navItems = [
  { route: 'timer', path: '/timer', label: 'Timer' },
  { route: 'dashboard', path: '/dashboard', label: 'Dashboard' },
  { route: 'compare', path: '/compare', label: 'Compare' },
  { route: 'manage', path: '/manage', label: 'Projects' },
];

const getRouteFromPath = () => {
  const clean = window.location.pathname.toLowerCase().replace(/^\/+/, '').split('/')[0];
  if (['timer', 'dashboard', 'compare', 'manage', 'settings', 'calendar', 'admin'].includes(clean)) {
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

const localStudyDateKey = (value) => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const calculateStudyStreak = (entries) => {
  const studiedDates = [...new Set((Array.isArray(entries) ? entries : [])
    .filter((entry) => Number(entry?.durationSeconds) > 0)
    .map((entry) => localStudyDateKey(entry.startedAt))
    .filter(Boolean))].sort();
  const serialFor = (key) => {
    const [year, month, day] = key.split('-').map(Number);
    return Date.UTC(year, month - 1, day) / 86400000;
  };
  const serials = studiedDates.map(serialFor);
  let longestStreak = 0;
  let run = 0;
  let previous = null;
  serials.forEach((serial) => {
    run = previous !== null && serial === previous + 1 ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
    previous = serial;
  });
  const todaySerial = serialFor(localStudyDateKey(new Date()));
  const activeSerials = new Set(serials);
  let cursor = activeSerials.has(todaySerial) ? todaySerial : activeSerials.has(todaySerial - 1) ? todaySerial - 1 : null;
  let currentStreak = 0;
  while (cursor !== null && activeSerials.has(cursor)) {
    currentStreak += 1;
    cursor -= 1;
  }
  return { currentStreak, longestStreak, lastStudyDate: studiedDates.at(-1) || null };
};

export const AppShell = ({ user, onLogout }) => {
  const [currentRoute, setCurrentRoute] = useState(getRouteFromPath);
  const visibleNavItems = user?.is_admin
    ? [...navItems, { route: 'admin', path: '/admin', label: 'Admin' }]
    : navItems;
  const activeTimerKey = user?.id
    ? `studyduel_user_${user.id}_active_timer`
    : 'studyduel_demo_active_timer';
  const entriesKey = user?.id
    ? `studyduel_user_${user.id}_time_entries`
    : 'studyduel_demo_time_entries';
  const streakKey = user?.id ? `studyduel_user_${user.id}_study_streak` : null;
  const projectsKey = user?.id ? `studyduel_user_${user.id}_projects` : 'studyduel_demo_projects';
  const remindersKey = user?.id ? `studyduel_user_${user.id}_reminders` : 'studyduel_demo_reminders';
  const preferencesKey = user?.id ? `studyduel_user_${user.id}_preferences` : 'studyduel_demo_preferences';
  const [preferences, setPreferences] = useState(() => {
    const initialPreferences = readLocalValue(preferencesKey, {});
    if (typeof document !== 'undefined') document.documentElement.dataset.dateFormat = initialPreferences.dateFormat || 'system';
    return initialPreferences;
  });
  const [reminderNotice, setReminderNotice] = useState(null);
  const [activeTimer, setActiveTimer] = useState(() => readLocalValue(activeTimerKey));
  const [timerNow, setTimerNow] = useState(Date.now());
  const [studyStreak, setStudyStreak] = useState(() => streakKey ? readLocalValue(streakKey, { currentStreak: 0, longestStreak: 0 }) : { currentStreak: 0, longestStreak: 0 });

  useEffect(() => {
    if (!streakKey) return;
    const next = calculateStudyStreak(readLocalValue(entriesKey, []));
    const saved = readLocalValue(streakKey, {});
    if (saved.currentStreak !== next.currentStreak || saved.longestStreak !== next.longestStreak || saved.lastStudyDate !== next.lastStudyDate) {
      localStorage.setItem(streakKey, JSON.stringify(next));
    }
    setStudyStreak((current) => current.currentStreak === next.currentStreak && current.longestStreak === next.longestStreak
      ? current
      : next);
  }, [entriesKey, streakKey, timerNow]);

  useLayoutEffect(() => {
    const initialPreferences = readLocalValue(preferencesKey, {});
    document.documentElement.dataset.dateFormat = initialPreferences.dateFormat || 'system';
    const syncPreferences = (event) => {
      if (event?.detail?.preferencesKey && event.detail.preferencesKey !== preferencesKey) return;
      const nextPreferences = readLocalValue(preferencesKey, {});
      document.documentElement.dataset.dateFormat = nextPreferences.dateFormat || 'system';
      setPreferences(nextPreferences);
    };
    window.addEventListener('studyduel:preferences-storage', syncPreferences);
    window.addEventListener('storage', syncPreferences);
    return () => {
      window.removeEventListener('studyduel:preferences-storage', syncPreferences);
      window.removeEventListener('storage', syncPreferences);
    };
  }, [preferencesKey]);

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
    const durationSeconds = Math.max(1, Math.floor((endedAt - Number(activeTimer.startedAt)) / 1000));
    const savedEntries = readLocalValue(entriesKey, []);
    const completedEntry = {
      id: crypto.randomUUID(),
      ...activeTimer,
      endedAt,
      durationSeconds,
    };
    const nextEntries = [completedEntry, ...(Array.isArray(savedEntries) ? savedEntries : [])];
    localStorage.setItem(entriesKey, JSON.stringify(nextEntries));
    localStorage.setItem(activeTimerKey, 'null');
    setActiveTimer(null);
    window.dispatchEvent(new CustomEvent('studyduel:timer-storage', {
      detail: { activeTimerKey, entriesKey },
    }));
  };

  useEffect(() => {
    const checkReminders = () => {
      const settings = readLocalValue(remindersKey, {});
      const entries = readLocalValue(entriesKey, []);
      const projects = readLocalValue(projectsKey, []);
      const now = new Date();
      const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const remindersFiredKey = `${remindersKey}_fired`;
      const fired = readLocalValue(remindersFiredKey, []);
      const notifyOnce = (key, message) => {
        if (fired.includes(key)) return false;
        localStorage.setItem(remindersFiredKey, JSON.stringify([...fired.slice(-99), key]));
        setReminderNotice({ id: key, message });
        return true;
      };
      const timeToMinutes = (value) => {
        const [hour, minute] = String(value || '20:00').split(':').map(Number);
        return (hour || 0) * 60 + (minute || 0);
      };
      const minutesNow = now.getHours() * 60 + now.getMinutes();
      const validEntries = Array.isArray(entries) ? entries : [];
      if (settings.dailyGoal && minutesNow >= timeToMinutes(settings.dailyTime)) {
        const todaySeconds = validEntries.filter((entry) => new Date(entry.startedAt).toDateString() === now.toDateString()).reduce((sum, entry) => sum + (Number(entry.durationSeconds) || 0), 0);
        const dailyGoalHours = (Array.isArray(projects) ? projects : []).filter((project) => !project.archived).reduce((sum, project) => sum + (project.subjects || []).reduce((part, subject) => part + (Number(subject.goals?.daily) || 0), 0), 0);
        if (dailyGoalHours > 0 && todaySeconds < dailyGoalHours * 3600 && notifyOnce(`daily-${todayKey}`, `You are ${Math.ceil((dailyGoalHours * 3600 - todaySeconds) / 60)} minutes short of today's goal.`)) return;
      }
      if (settings.weeklyGoal && now.getDay() === 6 && minutesNow >= timeToMinutes(settings.weeklyTime)) {
        const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
        const weekSeconds = validEntries.filter((entry) => new Date(entry.startedAt).getTime() >= weekStart.getTime()).reduce((sum, entry) => sum + (Number(entry.durationSeconds) || 0), 0);
        const weeklyGoal = (Array.isArray(projects) ? projects : []).filter((project) => !project.archived).reduce((sum, project) => sum + (project.subjects || []).reduce((part, subject) => part + (Number(subject.goals?.weekly) || 0), 0), 0);
        const weekKey = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
        if (weeklyGoal > 0 && weekSeconds < weeklyGoal * 3600 && notifyOnce(`weekly-${weekKey}`, `You are ${Math.ceil((weeklyGoal * 3600 - weekSeconds) / 60)} minutes short of this week's goal.`)) return;
      }
      if (settings.projectEstimate) {
        for (const project of (Array.isArray(projects) ? projects : []).filter((item) => !item.archived)) {
          const estimate = Number(project.estimateHours) || (project.subjects || []).reduce((sum, subject) => sum + (Number(subject.estimateHours) || 0), 0);
          if (!estimate) continue;
          const seconds = validEntries.filter((entry) => entry.projectId === project.id || (!entry.projectId && entry.projectName === project.name)).reduce((sum, entry) => sum + (Number(entry.durationSeconds) || 0), 0);
          const percent = Math.floor(seconds / (estimate * 3600) * 100);
          if (percent >= 80 && percent < 100 && notifyOnce(`estimate-${project.id}-${estimate}`, `${project.name} has reached ${percent}% of its planned time.`)) return;
        }
      }
      if (settings.longTimer && activeTimer?.startedAt) {
        const hours = Number(settings.longTimerHours) || 3;
        const elapsedHours = (now.getTime() - Number(activeTimer.startedAt)) / 3600000;
        if (elapsedHours >= hours && notifyOnce(`timer-${activeTimer.startedAt}-${hours}`, `Your ${activeTimer.projectName || 'study'} timer has been running for ${hours} hours.`)) return;
      }
    };
    checkReminders();
    const interval = window.setInterval(checkReminders, 30_000);
    return () => window.clearInterval(interval);
  }, [activeTimer?.startedAt, entriesKey, projectsKey, remindersKey]);

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

  useEffect(() => {
    if (!user?.id) return undefined;

    let lastTrackedAt = Date.now();
    let wasVisible = document.visibilityState === 'visible';
    const reportTime = (countElapsed = wasVisible) => {
      const now = Date.now();
      const elapsed = Math.floor((now - lastTrackedAt) / 1000);
      lastTrackedAt = now;
      if (!countElapsed || elapsed < 1) return;

      const body = JSON.stringify({ page: currentRoute, durationSeconds: Math.min(elapsed, 30) });
      fetch('/api/analytics/page-time', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {});
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        reportTime(wasVisible);
        wasVisible = false;
      } else {
        lastTrackedAt = Date.now();
        wasVisible = true;
      }
    };
    const handlePageHide = () => reportTime(wasVisible);
    const interval = window.setInterval(() => reportTime(wasVisible), 15_000);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      reportTime(wasVisible);
    };
  }, [currentRoute, user?.id]);

  const navigateTo = (route) => {
    window.history.pushState({}, '', `/${route}`);
    setCurrentRoute(route);
  };

  const isSettings = currentRoute === 'settings';
  const localDateTime = (() => {
    const now = new Date(timerNow);
    const time = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(now);
    const date = formatDisplayDate(now, { day: 'numeric', month: 'long', year: 'numeric' });
    return { label: `${time}, ${date}`, iso: now.toISOString() };
  })();

  return (
    <div className="app-shell-wrapper">
      {/* Persistent Top Navigation Bar */}
      <nav className="dashboard-nav" aria-label="PlotHour main navigation">
        <div className="nav-left">
          <button
            type="button"
            onClick={() => navigateTo('timer')}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            aria-label="Go to Timer"
          >
            <StudyDuelLogo size="medium" />
          </button>
          <span className="demo-mode-pill">
            {preferences.displayName || user?.display_name || 'Guest'}
          </span>
          <time className="nav-datetime" dateTime={localDateTime.iso}>
            {localDateTime.label}
          </time>
        </div>

        {/* 4 Primary Navigation Tabs: /timer, /dashboard, /compare, /manage */}
        <div className="dashboard-tabs" role="tablist" aria-label="Application sections">
            {visibleNavItems.map(({ route, label }) => {
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

        {/* Right Action Controls: Theme, Settings, Log out */}
        <div className="nav-right">
          {activeTimer && currentRoute !== 'timer' && (
            <div
              className="running-session-indicator"
              role="status"
              aria-label={`Timer running for ${activeTimer.projectName || 'study session'}${activeTimer.subjectName ? `, ${activeTimer.subjectName}` : ''}. Elapsed ${formatRunningTime(Math.max(0, Math.floor((timerNow - activeTimer.startedAt) / 1000)))}`}
              title={`${activeTimer.projectName || 'Study session'}${activeTimer.subjectName ? ` · ${activeTimer.subjectName}` : ''}`}
            >
              <span className="running-session-dot" aria-hidden="true" />
              <span className="running-session-context">
                {activeTimer.projectName || 'Study session'}{activeTimer.subjectName ? ` · ${activeTimer.subjectName}` : ''}
              </span>
              <time className="running-session-elapsed">
                {formatRunningTime(Math.max(0, Math.floor((timerNow - activeTimer.startedAt) / 1000)))}
              </time>
              <button
                type="button"
                className="running-session-stop"
                onClick={stopRunningTimer}
                aria-label={`Stop and save ${activeTimer.projectName || 'study'} session`}
                title="Stop and save session"
              >
                <Square size={12} fill="currentColor" strokeWidth={0} />
              </button>
            </div>
          )}
          {currentRoute === 'dashboard' && streakKey && (
            <div
              className="nav-study-streak"
              role="status"
              title={`${studyStreak.currentStreak} day current streak · ${studyStreak.longestStreak} day longest streak`}
              aria-label={`${studyStreak.currentStreak} day current study streak; longest streak ${studyStreak.longestStreak} days`}
            >
              <Flame size={16} aria-hidden="true" />
              <strong>{studyStreak.currentStreak} <small>{studyStreak.currentStreak === 1 ? 'day' : 'days'}</small></strong>
              <span>streak</span>
            </div>
          )}

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

      {reminderNotice && <aside className="app-reminder-toast" role="status"><span className="app-reminder-icon"><Bell size={16} /></span><span>{reminderNotice.message}</span><button type="button" aria-label="Dismiss reminder" onClick={() => setReminderNotice(null)}><X size={15} /></button></aside>}

      {/* Modular Section Content */}
      <main className="app-shell-content" id={`panel-${currentRoute}`} role="region">
        <div key={currentRoute} className="app-route-transition">
          {currentRoute === 'timer' && <TimerPage user={user} onNavigate={navigateTo} />}
          {currentRoute === 'dashboard' && <DashboardPage user={user} onNavigate={navigateTo} />}
          {currentRoute === 'compare' && <ComparePage user={user} onNavigate={navigateTo} />}
          {currentRoute === 'manage' && <ManagePage user={user} />}
          {currentRoute === 'settings' && (
            <SettingsPage user={user} />
          )}
          {currentRoute === 'calendar' && <CalendarPage user={user} />}
          {currentRoute === 'admin' && <AdminPage user={user} />}
        </div>
      </main>
    </div>
  );
};
