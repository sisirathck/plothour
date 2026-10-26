import React, { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { siteAssetUrl, useSiteCustomization } from '../../context/SiteCustomizationContext';
import './BackgroundBackdrop.css';

export const BackgroundBackdrop = () => {
  const { theme } = useTheme();
  const { config } = useSiteCustomization();
  // Only mount/fetch the active theme illustration initially; load the alternate only if toggled
  const [loadedThemes, setLoadedThemes] = useState(() => new Set([theme]));
  const [customSelection, setCustomSelection] = useState({ light: '', dark: '' });

  useEffect(() => {
    const login = config?.visuals?.login || {};
    setCustomSelection((current) => {
      const next = { ...current };
      for (const mode of ['light', 'dark']) {
        const ids = Array.isArray(login[mode]) ? login[mode] : [];
        if (!ids.length) next[mode] = '';
        else if (login.shuffle === false) next[mode] = ids.includes(current[mode]) ? current[mode] : ids[0];
        else next[mode] = ids[Math.floor(Math.random() * ids.length)];
      }
      return next;
    });
  }, [config?.visuals?.login]);

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
      {/* Light theme background */}
      {loadedThemes.has('light') && (
        <div
          className={`backdrop-layer light-layer${customSelection.light ? ' has-custom-background' : ''} ${theme === 'light' ? 'active' : ''}`}
          style={customSelection.light ? { backgroundImage: `url('${siteAssetUrl(customSelection.light)}')` } : undefined}
        />
      )}

      {/* Dark theme background */}
      {loadedThemes.has('dark') && (
        <div
          className={`backdrop-layer dark-layer${customSelection.dark ? ' has-custom-background' : ''} ${theme === 'dark' ? 'active' : ''}`}
          style={customSelection.dark ? { backgroundImage: `url('${siteAssetUrl(customSelection.dark)}')` } : undefined}
        />
      )}

      {/* Keep administrator-uploaded imagery readable behind the auth panel. */}
      {customSelection[theme] && <div className="backdrop-gradient-scrim" />}

      {/* Subtle vignette around edges */}
      <div className="backdrop-vignette" />
    </div>
  );
};
