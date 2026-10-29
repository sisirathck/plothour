import React, { useState, useEffect, Suspense, lazy } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { SiteCustomizationProvider } from './context/SiteCustomizationContext';
import { LoginPage } from './components/Auth/LoginPage';
import { connectWorkspaceSync } from './data/workspaceSync';
import { resetDemoWorkspace } from './data/demoWorkspace';
import './App.css';

// Lazy-load the heavy AppShell module (dashboard, timer, charts) so login loads instantly
const AppShell = lazy(() =>
  import('./components/Navigation/AppShell').then((m) => ({ default: m.AppShell }))
);

const validAppRoutes = ['/timer', '/dashboard', '/compare', '/manage', '/settings', '/calendar'];

function App() {
  const [user, setUser] = useState(null);
  const [isDemoMode, setIsDemoMode] = useState(() => {
    return (
      new URLSearchParams(window.location.search).get('extension') !== '1' && localStorage.getItem('studyduel_demo_mode') === 'true'
    );
  });
  const [authError, setAuthError] = useState('');
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [workspaceLoadError, setWorkspaceLoadError] = useState('');
  const [workspaceReadyForUser, setWorkspaceReadyForUser] = useState(null);

  useEffect(() => {
    if (!user?.id) {
      setWorkspaceReadyForUser(null);
      return undefined;
    }

    let cancelled = false;
    let disconnect = null;
    setWorkspaceReadyForUser(null);
    connectWorkspaceSync(user.id)
      .then((stopSync) => {
        if (cancelled) {
          stopSync();
          return;
        }
        disconnect = stopSync;
        setWorkspaceReadyForUser(user.id);
      })
      .catch((error) => {
        console.error('[Workspace sync] Could not load saved account data:', error.message);
        if (!cancelled) setWorkspaceLoadError('We couldn’t load your saved workspace. Your data has not been changed.');
      });

    return () => {
      cancelled = true;
      disconnect?.();
    };
  }, [user?.id]);

  // Sync demo mode in localStorage
  useEffect(() => {
    if (isDemoMode) {
      localStorage.setItem('studyduel_demo_mode', 'true');
    } else {
      localStorage.removeItem('studyduel_demo_mode');
    }
  }, [isDemoMode]);

  // Check existing session on load & preload AppShell in background during idle time
  useEffect(() => {
    let authenticated = false;
    fetch('/api/auth/me', { signal: AbortSignal.timeout(15000) })
      .then((res) => { if(res.status >= 500) throw new Error('The account service is temporarily unavailable.'); return res.ok ? res.json() : null; })
      .then((data) => {
        if (data?.user) {
          authenticated = true;
          setUser(data.user);
        }
      })
      .catch(() => { if(!isDemoMode) setAuthError('We couldn’t check your sign-in session. Please retry.'); })
      .finally(() => {
        if (!authenticated && isDemoMode) {
          const openingCalendarPopup = window.location.pathname.startsWith('/calendar');
          const hasExistingDemoEntries = Boolean(localStorage.getItem('studyduel_demo_time_entries'));
          if (!openingCalendarPopup || !hasExistingDemoEntries) resetDemoWorkspace();
        }
        setIsCheckingAuth(false);
      });

    // Idle-preload AppShell chunk so transitions into the dashboard are instantaneous
    const preload = () => {
      import('./components/Navigation/AppShell');
    };
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      window.requestIdleCallback(preload);
    } else {
      setTimeout(preload, 1500);
    }
  }, []);

  // Listen to browser navigation between login and app routes
  useEffect(() => {
    const handlePopState = () => {
      const isAppRoute = validAppRoutes.some((route) => window.location.pathname.startsWith(route));
      if (isAppRoute) {
        setIsDemoMode(localStorage.getItem('studyduel_demo_mode') === 'true');
      } else if (window.location.pathname === '/' || window.location.pathname === '/login') {
        if (!user) {
          setIsDemoMode(false);
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [user]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    setUser(null);
    setWorkspaceReadyForUser(null);
    setIsDemoMode(false);
    localStorage.removeItem('studyduel_demo_mode');
    window.history.pushState({}, '', '/');
  };

  // If user is directly loading an app route (/timer, /dashboard) while checking auth, show a refined themed spinner
  const themeScopeKey = user?.id
    ? `${user.id}:${workspaceReadyForUser === user.id ? 'ready' : 'loading'}`
    : isDemoMode ? 'demo' : 'guest';
  if (isCheckingAuth || authError || (user && workspaceReadyForUser !== user.id)) {
    return (
      <ThemeProvider key={themeScopeKey} userId={user?.id} demoMode={isDemoMode}>
        <SiteCustomizationProvider>
        <div className="app-loading-screen" aria-label="Loading PlotHour...">
          {workspaceLoadError || authError ? <div role="alert"><p>{workspaceLoadError || authError}</p><button type="button" onClick={() => window.location.reload()}>Retry loading workspace</button></div> : <div className="app-loading-spinner" />}
        </div>
        </SiteCustomizationProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider key={themeScopeKey} userId={user?.id} demoMode={isDemoMode}>
      <SiteCustomizationProvider>
      <div className="app-root">
        {user || isDemoMode ? (
          <Suspense
            fallback={
              <div className="app-loading-screen" aria-label="Loading workspace...">
                <div className="app-loading-spinner" />
              </div>
            }
          >
            <AppShell
              user={user}
              onLogout={handleLogout}
            />
          </Suspense>
        ) : (
          <LoginPage
            onTryDemo={() => {
              resetDemoWorkspace();
              setIsDemoMode(true);
              window.history.pushState({}, '', '/timer');
            }}
            onLoginSuccess={(authedUser) => {
              setWorkspaceReadyForUser(null);
              setUser(authedUser);
              window.history.pushState({}, '', '/timer');
            }}
          />
        )}
      </div>
      </SiteCustomizationProvider>
    </ThemeProvider>
  );
}

export default App;
