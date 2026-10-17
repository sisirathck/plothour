import React, { useState, useEffect } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { LoginPage } from './components/Auth/LoginPage';
import { GuestDashboard } from './components/DemoDashboard/GuestDashboard';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

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

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    setUser(null);
    setIsDemoMode(false);
  };

  if (isCheckingAuth) {
    return null;
  }

  return (
    <ThemeProvider>
      <div className="app-root">
        {user ? (
          <GuestDashboard user={user} onExitGuest={handleLogout} />
        ) : isDemoMode ? (
          <GuestDashboard user={null} onExitGuest={() => setIsDemoMode(false)} />
        ) : (
          <LoginPage
            onTryDemo={() => setIsDemoMode(true)}
            onLoginSuccess={(authedUser) => setUser(authedUser)}
          />
        )}
      </div>
    </ThemeProvider>
  );
}

export default App;
