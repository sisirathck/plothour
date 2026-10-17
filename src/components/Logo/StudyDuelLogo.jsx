import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import './StudyDuelLogo.css';

/**
 * StudyDuelLogo Component
 * Transparent logo with zero background, consistent across both light and dark modes.
 * In light mode: renders /studyduel_logo.png
 * In dark mode: renders /studyduel_logo_dark.png (white 'Study' text with transparent background)
 */
export const StudyDuelLogo = ({ className = '', size = 'medium' }) => {
  const { theme } = useTheme();
  const logoSrc = theme === 'dark' ? '/studyduel_logo_dark.png' : '/studyduel_logo.png';

  return (
    <div className={`studyduel-logo-wrapper size-${size} ${className}`}>
      <img
        src={logoSrc}
        alt="StudyDuel Logo"
        className="studyduel-logo-img"
        draggable={false}
      />
    </div>
  );
};
