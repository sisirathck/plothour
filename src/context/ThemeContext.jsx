import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext({
  theme: 'light',
  themeMode: 'auto-daylight',
  toggleTheme: () => {},
  setTheme: () => {},
  setThemeMode: () => {},
});

const getAutoDaylightTheme = () => {
  const hour = new Date().getHours();
  // Light mode from 06:00–17:59, Dark mode from 18:00–05:59 based on system time
  return hour >= 6 && hour < 18 ? 'light' : 'dark';
};

const resolveTheme = (mode) => {
  if (mode === 'light' || mode === 'dark') return mode;
  return getAutoDaylightTheme();
};

export const ThemeProvider = ({ children, userId = null, demoMode = false }) => {
  const scopedKeys = userId
    ? { mode: `studyduel_user_${userId}_theme_mode`, theme: `studyduel_user_${userId}_theme` }
    : demoMode
      ? { mode: 'studyduel_demo_theme_mode', theme: 'studyduel_demo_theme' }
      : { mode: 'studyduel_theme_mode', theme: 'studyduel_theme' };
  const [themeMode, setThemeModeState] = useState(() => {
    const savedMode = localStorage.getItem(scopedKeys.mode) || (!userId && !demoMode ? localStorage.getItem('studyduel_theme_mode') : null);
    if (savedMode === 'light' || savedMode === 'dark' || savedMode === 'auto-daylight') {
      return savedMode;
    }
    const legacy = localStorage.getItem(scopedKeys.theme) || (!userId && !demoMode ? localStorage.getItem('studyduel_theme') : null);
    if (legacy === 'light' || legacy === 'dark') {
      return legacy;
    }
    return 'auto-daylight';
  });

  const [theme, setThemeState] = useState(() => resolveTheme(themeMode));

  useEffect(() => {
    const resolved = resolveTheme(themeMode);
    setThemeState(resolved);
    document.documentElement.setAttribute('data-theme', resolved);
    localStorage.setItem(scopedKeys.theme, resolved);
    localStorage.setItem(scopedKeys.mode, themeMode);

    if (themeMode === 'auto-daylight') {
      const interval = setInterval(() => {
        const nextResolved = getAutoDaylightTheme();
        setThemeState((prev) => {
          if (prev !== nextResolved) {
            document.documentElement.setAttribute('data-theme', nextResolved);
            localStorage.setItem(scopedKeys.theme, nextResolved);
            return nextResolved;
          }
          return prev;
        });
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [themeMode, scopedKeys.mode, scopedKeys.theme]);

  const toggleTheme = () => {
    setThemeModeState((prev) => {
      const currentResolved = resolveTheme(prev);
      return currentResolved === 'light' ? 'dark' : 'light';
    });
  };

  const setThemeMode = (newMode) => {
    if (newMode === 'light' || newMode === 'dark' || newMode === 'auto-daylight') {
      setThemeModeState(newMode);
    }
  };

  const setTheme = (newTheme) => {
    setThemeMode(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, themeMode, toggleTheme, setTheme, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

