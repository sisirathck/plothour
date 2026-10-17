import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import './BackgroundBackdrop.css';

export const BackgroundBackdrop = () => {
  const { theme } = useTheme();

  return (
    <div className="studyduel-backdrop-root" aria-hidden="true">
      {/* Light theme illustration */}
      <div
        className={`backdrop-layer light-layer ${theme === 'light' ? 'active' : ''}`}
        style={{ backgroundImage: `url('/login_whitetheme.png')` }}
      />

      {/* Dark theme illustration */}
      <div
        className={`backdrop-layer dark-layer ${theme === 'dark' ? 'active' : ''}`}
        style={{ backgroundImage: `url('/login_darktheme.png')` }}
      />

      {/* Ambient gradient overlay for enhanced readability on the left */}
      <div className="backdrop-gradient-scrim" />

      {/* Subtle vignette around edges */}
      <div className="backdrop-vignette" />
    </div>
  );
};
