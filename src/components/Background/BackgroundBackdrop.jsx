import React, { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import './BackgroundBackdrop.css';

export const BackgroundBackdrop = () => {
  const { theme } = useTheme();
  // Only mount/fetch the active theme illustration initially; load the alternate only if toggled
  const [loadedThemes, setLoadedThemes] = useState(() => new Set([theme]));

  useEffect(() => {
    setLoadedThemes((prev) => {
      if (prev.has(theme)) return prev;
      const next = new Set(prev);
      next.add(theme);
      return next;
    });
  }, [theme]);

  return (
    <div className="studyduel-backdrop-root" aria-hidden="true">
      {/* Light theme illustration */}
      {loadedThemes.has('light') && (
        <div
          className={`backdrop-layer light-layer ${theme === 'light' ? 'active' : ''}`}
          style={{ backgroundImage: `url('/login_whitetheme.webp')` }}
        />
      )}

      {/* Dark theme illustration */}
      {loadedThemes.has('dark') && (
        <div
          className={`backdrop-layer dark-layer ${theme === 'dark' ? 'active' : ''}`}
          style={{ backgroundImage: `url('/login_darktheme.webp')` }}
        />
      )}

      {/* Ambient gradient overlay for enhanced readability on the left */}
      <div className="backdrop-gradient-scrim" />

      {/* Subtle vignette around edges */}
      <div className="backdrop-vignette" />
    </div>
  );
};
