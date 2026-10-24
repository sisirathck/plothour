import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { siteAssetUrl, useSiteCustomization } from '../../context/SiteCustomizationContext';
import './StudyDuelLogo.css';
import lightLogo from '../../assets/studyduel_logo_light.webp';

/**
 * StudyDuelLogo Component
 * Transparent logo with zero background, consistent across both light and dark modes.
 * In light mode: renders studyduel_logo_light.webp
 * In dark mode: renders /studyduel_logo_dark.webp
 */
export const StudyDuelLogo = ({ className = '', size = 'medium' }) => {
  const { theme } = useTheme();
  const { config } = useSiteCustomization();
  const isDark = theme === 'dark';
  const customLogo = config?.visuals?.logo?.[isDark ? 'dark' : 'light'];

  return (
    <div
      className={`studyduel-logo-wrapper size-${size} ${className}`}
      role="img"
      aria-label="StudyDuel"
    >
      {customLogo ? (
        <img src={siteAssetUrl(customLogo)} alt="" className="studyduel-logo-img" draggable={false} />
      ) : isDark ? (
        <img
          src="/studyduel_logo_dark.webp"
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
