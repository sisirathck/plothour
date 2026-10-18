import React, { useState, useEffect } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { LoginPage } from './components/Auth/LoginPage';
import { AppShell } from './components/Navigation/AppShell';
import './App.css';

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

  // Sync demo mode in localStorage
  useEffect(() => {
    if (isDemoMode) {
      localStorage.setItem('studyduel_demo_mode', 'true');
    } else {
      localStorage.removeItem('studyduel_demo_mode');
    }
  }, [isDemoMode]);

  // Check existing session on load
  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) {
          setUser(data.user);
        }
      })
      .catch(() => {})
      .finally(() => {
        setIsCheckingAuth(false);
      });
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
    setIsDemoMode(false);
    localStorage.removeItem('studyduel_demo_mode');
    window.history.pushState({}, '', '/');
  };

  if (isCheckingAuth) {
    return null;
  }

  return (
    <ThemeProvider>
      <div className="app-root">
        {user || isDemoMode ? (
          <AppShell
            user={user}
            onLogout={handleLogout}
          />
        ) : (
          <LoginPage
            onTryDemo={() => {
              setIsDemoMode(true);
              window.history.pushState({}, '', '/timer');
            }}
            onLoginSuccess={(authedUser) => {
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
