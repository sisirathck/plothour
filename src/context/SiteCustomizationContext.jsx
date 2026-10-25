import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export const SITE_COPY_FIELDS = [
  { page: 'login', key: 'tagline', label: 'Brand tagline', fallback: 'A little progress, every day' },
  { page: 'login', key: 'welcomeTitle', label: 'Login title', fallback: 'Welcome back' },
  { page: 'login', key: 'welcomeSubtitle', label: 'Login description', fallback: 'Sign in to your dashboard and keep your progress moving.' },
  { page: 'login', key: 'signUpTitle', label: 'Signup title', fallback: 'Create your account' },
  { page: 'login', key: 'signUpSubtitle', label: 'Signup description', fallback: 'Join PlotHour and keep your progress moving.' },
  { page: 'login', key: 'emailLabel', label: 'Email field label', fallback: 'Email' },
  { page: 'login', key: 'passwordLabel', label: 'Password field label', fallback: 'Password' },
  { page: 'login', key: 'loginButton', label: 'Login button', fallback: 'Log in' },
  { page: 'login', key: 'createAccountButton', label: 'Create account button', fallback: 'Create account' },
  { page: 'login', key: 'signUpButton', label: 'Sign up link', fallback: 'Sign up' },
  { page: 'login', key: 'forgotPassword', label: 'Forgot password link', fallback: 'Forgot password?' },
  { page: 'timer', key: 'searchPlaceholder', label: 'Project search placeholder', fallback: 'Search projects or subjects to start a session' },
  { page: 'timer', key: 'activeSectionTitle', label: 'Active project section', fallback: 'ACTIVE PROJECT & SUBJECT' },
  { page: 'timer', key: 'activeSectionSub', label: 'Project section helper', fallback: 'Configure Session' },
  { page: 'timer', key: 'projectLabel', label: 'Project field label', fallback: 'PROJECT' },
  { page: 'timer', key: 'subjectLabel', label: 'Subject field label', fallback: 'SUBJECT' },
  { page: 'timer', key: 'frequentTitle', label: 'Frequent combos heading', fallback: 'TOP FREQUENT COMBOS' },
  { page: 'timer', key: 'frequentSub', label: 'Frequent combos helper', fallback: '1-Click Launch' },
  { page: 'timer', key: 'startButton', label: 'Start button', fallback: 'Start' },
  { page: 'timer', key: 'stopButton', label: 'Stop button', fallback: 'Stop' },
  { page: 'timer', key: 'startSessionButton', label: 'Start session button', fallback: 'Start Session' },
  { page: 'timer', key: 'stopSaveButton', label: 'Stop and save button', fallback: 'Stop & Save' },
  { page: 'timer', key: 'pauseButton', label: 'Pause button', fallback: 'Pause' },
  { page: 'timer', key: 'resumeButton', label: 'Resume button', fallback: 'Resume' },
  { page: 'timer', key: 'sessionNotePlaceholder', label: 'Session note placeholder', fallback: 'Add a note to this session…' },
  { page: 'dashboard', key: 'dailyGoalTitle', label: 'Daily goal card title', fallback: 'Daily Goal' },
  { page: 'dashboard', key: 'weeklyReviewTitle', label: 'Weekly review heading', fallback: 'Weekly review' },
  { page: 'dashboard', key: 'timeTrackedLabel', label: 'Time tracked metric label', fallback: 'TIME TRACKED' },
  { page: 'dashboard', key: 'sessionsPerDayLabel', label: 'Sessions per day metric label', fallback: 'AVG SESSIONS / DAY' },
  { page: 'dashboard', key: 'sessionsLabel', label: 'Sessions metric label', fallback: 'SESSIONS' },
  { page: 'dashboard', key: 'activeDaysLabel', label: 'Active days metric label', fallback: 'ACTIVE DAYS' },
  { page: 'dashboard', key: 'averageSessionLabel', label: 'Average session metric label', fallback: 'AVG / SESSION' },
  { page: 'dashboard', key: 'calendarButton', label: 'Calendar button', fallback: 'Calendar View' },
  { page: 'dashboard', key: 'calendarDescription', label: 'Calendar button description', fallback: 'Browse study sessions by day' },
  { page: 'dashboard', key: 'dailyStudyTitle', label: 'Daily study chart title', fallback: 'Daily Study' },
  { page: 'dashboard', key: 'weeklyStudyTitle', label: 'Weekly study chart title', fallback: 'Weekly Study' },
  { page: 'dashboard', key: 'studyVolumeTitle', label: 'Study volume chart title', fallback: 'Study Volume' },
  { page: 'manage', key: 'title', label: 'Page title', fallback: 'Project library' },
  { page: 'manage', key: 'subtitle', label: 'Page description', fallback: 'Shape your study plan, set targets, and keep completed projects within reach.' },
  { page: 'manage', key: 'searchPlaceholder', label: 'Project search placeholder', fallback: 'Find a project' },
  { page: 'manage', key: 'createProjectButton', label: 'Create project button', fallback: 'Create project' },
  { page: 'manage', key: 'newProjectPlaceholder', label: 'New project placeholder', fallback: 'Add a project, e.g. Biology or Thesis' },
  { page: 'manage', key: 'activeTab', label: 'Active projects tab', fallback: 'Active' },
  { page: 'manage', key: 'archivedTab', label: 'Archived projects tab', fallback: 'Archived' },
  { page: 'compare', key: 'periodLabel', label: 'Compare period heading', fallback: 'PERIOD STANDINGS' },
  { page: 'compare', key: 'periodTitle', label: 'Compare standings title', fallback: 'Period standings' },
  { page: 'compare', key: 'studyTimeByWeek', label: 'Weekly chart title', fallback: 'Study time by week' },
  { page: 'compare', key: 'shareButton', label: 'Share recap button', fallback: 'Share recap' },
];

const defaultConfig = { copy: {}, visuals: {} };

export const SITE_FONT_OPTIONS = [
  { id: 'belleza', name: 'Belleza', family: 'Belleza', group: 'Brand', descriptor: 'PlotHour flared serif' },
  { id: 'nunito', name: 'Nunito', family: 'Nunito', group: 'Casual', descriptor: 'Friendly and rounded' },
  { id: 'quicksand', name: 'Quicksand', family: 'Quicksand', group: 'Casual', descriptor: 'Soft geometric shapes' },
  { id: 'poppins', name: 'Poppins', family: 'Poppins', group: 'Casual', descriptor: 'Modern and expressive' },
  { id: 'rubik', name: 'Rubik', family: 'Rubik', group: 'Casual', descriptor: 'Warm, compact forms' },
  { id: 'comfortaa', name: 'Comfortaa', family: 'Comfortaa', group: 'Casual', descriptor: 'Distinctly rounded' },
  { id: 'inter', name: 'Inter', family: 'Inter', group: 'Enterprise', descriptor: 'Clear product interface' },
  { id: 'roboto', name: 'Roboto', family: 'Roboto', group: 'Enterprise', descriptor: 'Neutral and familiar' },
  { id: 'open-sans', name: 'Open Sans', family: 'Open Sans', group: 'Enterprise', descriptor: 'Highly readable' },
  { id: 'source-sans-3', name: 'Source Sans 3', family: 'Source Sans 3', group: 'Enterprise', descriptor: 'Polished and practical' },
  { id: 'ibm-plex-sans', name: 'IBM Plex Sans', family: 'IBM Plex Sans', group: 'Enterprise', descriptor: 'Precise and technical' },
  { id: 'noto-sans', name: 'Noto Sans', family: 'Noto Sans', group: 'Google Noto', descriptor: 'Broad language coverage' },
];

const fontById = new Map(SITE_FONT_OPTIONS.map((option) => [option.id, option]));
export const getSiteFontFamily = (config, page) => {
  const id = config?.fonts?.[page];
  return fontById.get(id)?.family || 'Belleza';
};
export const getSiteFontStyle = (config, page) => {
  const family = `'${getSiteFontFamily(config, page)}', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
  return { '--font-sans': family, fontFamily: family };
};

const SiteCustomizationContext = createContext({ config: defaultConfig, refresh: () => {}, text: (_page, _key, fallback) => fallback });

export const siteAssetUrl = (assetId) => assetId ? `/api/site-assets/${encodeURIComponent(assetId)}` : '';

export const SiteCustomizationProvider = ({ children }) => {
  const [config, setConfig] = useState(defaultConfig);
  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/site-config', { cache: 'no-store' });
      if (!response.ok) return;
      const payload = await response.json();
      setConfig({ ...defaultConfig, ...payload });
    } catch { /* Keep bundled defaults if site configuration is temporarily unavailable. */ }
  }, []);

  useEffect(() => {
    refresh();
    const onUpdate = () => refresh();
    window.addEventListener('studyduel:site-customization-updated', onUpdate);
    return () => window.removeEventListener('studyduel:site-customization-updated', onUpdate);
  }, [refresh]);

  useEffect(() => {
    const families = [...new Set(Object.keys(config?.fonts || {}).map((page) => getSiteFontFamily(config, page)))];
    const params = new URLSearchParams();
    families.forEach((family) => params.append('family', `${family}:wght@400;500;600;700`));
    params.set('display', 'swap');
    let stylesheet = document.querySelector('#studyduel-custom-fonts');
    if (!stylesheet) {
      stylesheet = document.createElement('link');
      stylesheet.id = 'studyduel-custom-fonts';
      stylesheet.rel = 'stylesheet';
      document.head.appendChild(stylesheet);
    }
    stylesheet.href = `https://fonts.googleapis.com/css2?${params.toString()}`;
  }, [config?.fonts]);

  const text = useCallback((page, key, fallback) => {
    const value = config?.copy?.[page]?.[key];
    return typeof value === 'string' && value.trim() ? value : fallback;
  }, [config]);
  const value = useMemo(() => ({ config, refresh, text }), [config, refresh, text]);
  return <SiteCustomizationContext.Provider value={value}>{children}</SiteCustomizationContext.Provider>;
};

export const useSiteCustomization = () => useContext(SiteCustomizationContext);
