import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { siteAssetUrl, useSiteCustomization } from '../../context/SiteCustomizationContext';
import './StudyDuelLogo.css';

/**
 * PlotHour brand mark, with administrator-uploaded logos supported per theme.
 */
export const StudyDuelLogo = ({ className = '', size = 'medium' }) => {
  const { theme } = useTheme();
  const { config } = useSiteCustomization();
  const isDark = theme === 'dark';
  const customLogo = config?.visuals?.logo?.[isDark ? 'dark' : 'light'];
  const defaultLogo = isDark ? '/plothour-logo-dark.png' : '/plothour-logo-light.png';

  return (
    <div
      className={`studyduel-logo-wrapper size-${size} ${className}`}
      role="img"
      aria-label="PlotHour"
    >
      <img src={customLogo ? siteAssetUrl(customLogo) : defaultLogo} alt="" className="studyduel-logo-img" draggable={false} />
    </div>
  );
};
