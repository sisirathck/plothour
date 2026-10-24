import React, { useState, useEffect, Suspense, lazy } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { LoginPage } from './components/Auth/LoginPage';
import { connectWorkspaceSync } from './data/workspaceSync';
import { resetDemoWorkspace } from './data/demoWorkspace';
import './App.css';

// Lazy-load the heavy AppShell module (dashboard, timer, charts) so login loads instantly
const AppShell = lazy(() =>
  import('./components/Navigation/AppShell').then((m) => ({ default: m.AppShell }))
);

const validAppRoutes = ['/timer', '/dashboard', '/compare', '/manage', '/settings'];

function App() {
  const [user, setUser] = useState(null);
  const [isDemoMode, setIsDemoMode] = useState(() => {
    return (
      validAppRoutes.some((route) => window.location.pathname.startsWith(route)) ||
      localStorage.getItem('studyduel_demo_mode') === 'true'
    );
  });
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
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
        if (!cancelled) setWorkspaceReadyForUser(user.id);
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
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) {
          authenticated = true;
          setUser(data.user);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!authenticated && isDemoMode) resetDemoWorkspace();
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
        setIsDemoMode(true);
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
  const isDirectAppRoute = validAppRoutes.some((route) => window.location.pathname.startsWith(route));
  const themeScopeKey = user?.id
    ? `${user.id}:${workspaceReadyForUser === user.id ? 'ready' : 'loading'}`
    : isDemoMode ? 'demo' : 'guest';
  if ((isCheckingAuth && (isDirectAppRoute || isDemoMode)) || (user && workspaceReadyForUser !== user.id)) {
    return (
      <ThemeProvider key={themeScopeKey} userId={user?.id} demoMode={isDemoMode}>
        <div className="app-loading-screen" aria-label="Loading StudyDuel...">
          <div className="app-loading-spinner" />
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider key={themeScopeKey} userId={user?.id} demoMode={isDemoMode}>
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
    </ThemeProvider>
  );
}

export default App;
