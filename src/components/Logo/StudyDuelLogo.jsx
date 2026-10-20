import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import './StudyDuelLogo.css';
import lightLogo from '../../assets/studyduel_logo_light.png';

/**
 * StudyDuelLogo Component
 * Transparent logo with zero background, consistent across both light and dark modes.
 * In light mode: renders /studyduel_logo_light.png with the warm logo accents recolored violet.
 * In dark mode: renders /studyduel_logo_dark.png (white 'Study' text with transparent background)
 */
export const StudyDuelLogo = ({ className = '', size = 'medium' }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div
      className={`studyduel-logo-wrapper size-${size} ${className}`}
      role="img"
      aria-label="StudyDuel"
    >
      {isDark ? (
        <img
          src="/studyduel_logo_dark.png"
          alt=""
          className="studyduel-logo-img"
          draggable={false}
        />
      ) : (
        <img
          src={lightLogo}
          alt=""
          className="studyduel-logo-lightmark"
          draggable={false}
        />
      )}
    </div>
  );
};
