import React, { useState } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { LoginPage } from './components/Auth/LoginPage';
import { GuestDashboard } from './components/DemoDashboard/GuestDashboard';
import './App.css';

function App() {
  const [isDemoMode, setIsDemoMode] = useState(false);

  return (
    <ThemeProvider>
      <div className="app-root">
        {isDemoMode ? (
          <GuestDashboard onExitGuest={() => setIsDemoMode(false)} />
        ) : (
          <LoginPage onTryDemo={() => setIsDemoMode(true)} />
        )}
      </div>
    </ThemeProvider>
  );
}

export default App;
