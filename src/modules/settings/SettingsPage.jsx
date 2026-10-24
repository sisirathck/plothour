import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Clock3,
  Copy,
  Download,
  FileJson,
  FileSpreadsheet,
  Flame,
  Moon,
  Settings2,
  Save,
  Sliders,
  Sparkles,
  Sun,
  User,
  UserPlus,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import './Settings.css';

const getUserKey = (user, suffix) =>
  user?.id ? `studyduel_user_${user.id}_${suffix}` : `studyduel_demo_${suffix}`;

const readJson = (key, fallback) => {
  try {
    const data = JSON.parse(localStorage.getItem(key) || 'null');
    return data ?? fallback;
  } catch {
    return fallback;
  }
};

const downloadFile = (content, type, filename) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 100);
};

const csvCell = (value) => {
  const text = String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
};

// 528Hz Harmonic Sine Bell Synthesizer (Zen Bell) with smooth 1.3s exponential decay
export const playZenBell = () => {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    if (context.state === 'suspended') {
      context.resume();
    }
    const now = context.currentTime;
    const duration = 1.3;

    // Primary 528 Hz sine wave (solfeggio chime)
    const osc1 = context.createOscillator();
    const gain1 = context.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(528, now);

    // Harmonic overtone 1056 Hz (528 * 2) for rich acoustic bell resonance
    const osc2 = context.createOscillator();
    const gain2 = context.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1056, now);

    // Smooth 1.3-second exponential gain decay
    gain1.gain.setValueAtTime(0.24, now);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    gain2.gain.setValueAtTime(0.08, now);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc1.connect(gain1);
    osc2.connect(gain2);
    gain1.connect(context.destination);
    gain2.connect(context.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + duration);
    osc2.stop(now + duration);

    osc1.onended = () => {
      try {
        context.close();
      } catch {}
    };
  } catch (error) {
    console.warn('Unable to synthesize zen bell chime:', error);
  }
};

export const SettingsPage = ({ onBack, user }) => {
  const preferencesKey = getUserKey(user, 'preferences');
  const entriesKey = getUserKey(user, 'time_entries');
  const friendsKey = getUserKey(user, 'friends');
  const inviteCodeKey = getUserKey(user, 'invite_code');

  const { themeMode, setThemeMode } = useTheme();
  const systemTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const weekDays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const timezones = useMemo(() => {
    const supported = typeof Intl.supportedValuesOf === 'function'
      ? Intl.supportedValuesOf('timeZone')
      : ['UTC', 'America/Los_Angeles', 'America/Chicago', 'America/New_York', 'Europe/London', 'Europe/Paris', 'Asia/Kolkata', 'Asia/Tokyo', 'Australia/Sydney'];
    return [...new Set([systemTimezone, ...supported])].sort((a, b) => a.localeCompare(b));
  }, [systemTimezone]);

  // 2-Tab Architecture state ('preferences' | 'connections')
  const [activeSettingsTab, setActiveSettingsTab] = useState(() => {
    try {
      const savedTab = localStorage.getItem('studyduel_settings_tab');
      return savedTab === 'connections' ? 'connections' : 'preferences';
    } catch {
      return 'preferences';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('studyduel_settings_tab', activeSettingsTab);
    } catch {}
  }, [activeSettingsTab]);

  // Tab 1: Preferences State
  const [preferences, setPreferences] = useState(() => {
    const saved = readJson(preferencesKey, {});
    return {
      dailyGoalHours: 4,
      weekStart: weekDays[Number.isInteger(user?.week_starts_on) ? user.week_starts_on : 1] || 'monday',
      timezone: systemTimezone,
      defaultTimerMode: '50m',
      soundEnabled: true,
      ...saved,
      // The account profile is shared with connections; stale local preferences
      // must not mask the public display name stored on the account.
      displayName: user?.display_name || saved.displayName || user?.email?.split('@')[0] || 'Alex Rivera',
    };
  });

  const [saveStatus, setSaveStatus] = useState('');
  const updatePreference = (key, value) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
    setSaveStatus('');
  };

  const saveSettings = async () => {
    setSaveStatus('saving');
    try {
      if (user?.id) {
        const response = await fetch('/api/auth/profile', {
          method: 'PATCH',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            displayName: preferences.displayName,
            timezone: preferences.timezone,
            weekStartsOn: weekDays.indexOf(preferences.weekStart),
          }),
        });
        if (!response.ok) {
          const result = await response.json().catch(() => ({}));
          throw new Error(result.error || 'Could not save profile settings.');
        }
      }
      localStorage.setItem(preferencesKey, JSON.stringify(preferences));
      window.dispatchEvent(new CustomEvent('studyduel:preferences-storage', {
        detail: { preferencesKey, preferences },
      }));
      setSaveStatus('saved');
    } catch (error) {
      console.error('Could not save settings:', error);
      setSaveStatus(error.message || 'error');
    }
  };

  // Export logs feedback state
  const [exportStatus, setExportStatus] = useState('');

  useEffect(() => {
    if (!exportStatus) return undefined;
    const timer = window.setTimeout(() => setExportStatus(''), 2000);
    return () => window.clearTimeout(timer);
  }, [exportStatus]);

  // CSV Export
  const exportCSV = () => {
    const storedEntries = readJson(entriesKey, []);
    const entries = Array.isArray(storedEntries) ? storedEntries : [];
    const headers = [
      'session_id',
      'date',
      'day',
      'project',
      'duration_minutes',
      'timer_mode',
      'completed',
    ];

    const rows = entries.map((entry) => {
      const startedAt = entry.startedAt ? new Date(entry.startedAt) : null;
      const isValidDate = startedAt && !Number.isNaN(startedAt.getTime());
      const dateStr = isValidDate ? startedAt.toISOString().slice(0, 10) : '';
      const dayStr = isValidDate
        ? startedAt.toLocaleDateString('en-US', { weekday: 'short' })
        : '';
      const projectStr = entry.projectName || entry.project || 'General Study';
      const durationMinutes = Math.round((Number(entry.durationSeconds) || 0) / 60);
      const timerMode = entry.mode || preferences.defaultTimerMode || '50m';
      const completed = true;

      return [
        csvCell(entry.id || crypto.randomUUID()),
        csvCell(dateStr),
        csvCell(dayStr),
        csvCell(projectStr),
        csvCell(durationMinutes),
        csvCell(timerMode),
        csvCell(completed),
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\r\n');
    const dateStamp = new Date().toISOString().slice(0, 10);
    downloadFile(
      `\uFEFF${csvContent}`,
      'text/csv;charset=utf-8;',
      `studyduel_logs_${dateStamp}.csv`
    );
    setExportStatus('csv');
  };

  // JSON Export
  const exportJSON = () => {
    const storedEntries = readJson(entriesKey, []);
    const entries = Array.isArray(storedEntries) ? storedEntries : [];
    const logs = entries.map((entry) => {
      const startedAt = entry.startedAt ? new Date(entry.startedAt) : null;
      const isValidDate = startedAt && !Number.isNaN(startedAt.getTime());
      return {
        session_id: entry.id || crypto.randomUUID(),
        date: isValidDate ? startedAt.toISOString().slice(0, 10) : '',
        day: isValidDate ? startedAt.toLocaleDateString('en-US', { weekday: 'short' }) : '',
        project: entry.projectName || entry.project || 'General Study',
        duration_minutes: Math.round((Number(entry.durationSeconds) || 0) / 60),
        timer_mode: entry.mode || preferences.defaultTimerMode || '50m',
        completed: true,
      };
    });

    const dateStamp = new Date().toISOString().slice(0, 10);
    downloadFile(
      JSON.stringify(logs, null, 2),
      'application/json',
      `studyduel_logs_${dateStamp}.json`
    );
    setExportStatus('json');
  };

  // Tab 2: Connections State
  const [userInviteCode, setUserInviteCode] = useState(() => {
    if (user?.id) return '';
    const stored = localStorage.getItem(inviteCodeKey);
    if (stored) return stored;
    const randomBytes = new Uint8Array(5);
    if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(randomBytes);
    else randomBytes.set(Array.from({ length: 5 }, () => Math.floor(Math.random() * 256)));
    const generated = `DUEL-${Array.from(randomBytes, (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
    try {
      localStorage.setItem(inviteCodeKey, generated);
    } catch {}
    return generated;
  });

  const [copiedInvite, setCopiedInvite] = useState(false);
  const [peerCodeInput, setPeerCodeInput] = useState('');
  const [friendNotice, setFriendNotice] = useState(null);

  const [friends, setFriends] = useState(() => {
    const saved = readJson(friendsKey, []);
    const mockFriendIds = new Set(['friend-1', 'friend-2', 'friend-3']);
    const mockFriendCodes = new Set(['DUEL-4821', 'DUEL-9104', 'DUEL-3390']);
    const realFriends = Array.isArray(saved)
      ? saved.filter((friend) => !mockFriendIds.has(friend.id) && !mockFriendCodes.has(friend.code))
      : [];
    try {
      localStorage.setItem(friendsKey, JSON.stringify(realFriends));
    } catch {}
    return realFriends;
  });

  useEffect(() => {
    if (!user?.id) return undefined;
    let active = true;
    fetch('/api/connections', { credentials: 'same-origin' })
      .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || 'Could not load study partners.');
        if (!active) return;
        setUserInviteCode(result.inviteCode || '');
        const partners = Array.isArray(result.connections) ? result.connections : [];
        setFriends(partners.map((friend) => ({
          ...friend,
          streakDays: 0,
          status: 'Connected',
          isStudying: false,
          todayHours: 0,
          goalHours: 0,
          isRemoteConnection: true,
        })));
      })
      .catch((error) => {
        if (active) setFriendNotice({ type: 'error', message: error.message });
      });
    return () => { active = false; };
  }, [user?.id]);

  const copyInviteCode = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(userInviteCode);
      } else {
        const input = document.createElement('textarea');
        input.value = userInviteCode;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopiedInvite(true);
      window.setTimeout(() => setCopiedInvite(false), 2000);
    } catch (err) {
      console.warn('Clipboard copy error:', err);
    }
  };

  const handleAddFriend = async (e) => {
    e?.preventDefault();
    const cleanCode = peerCodeInput.trim().toUpperCase();
    if (!cleanCode) return;

    if (user?.id) {
      if (!/^DUEL-[0-9A-F]{10}$/.test(cleanCode)) {
        setFriendNotice({
          type: 'error',
          message: 'This invite code is out of date. Current codes look like DUEL-1A2B3C4D5E; copy the code shown in Settings after refreshing StudyDuel.',
        });
        return;
      }
      try {
        const response = await fetch('/api/connections', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: cleanCode }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || 'Could not connect this study partner.');
        const listing = await fetch('/api/connections', { credentials: 'same-origin' });
        const listingResult = await listing.json();
        setFriends((listingResult.connections || []).map((friend) => ({
          ...friend, streakDays: 0, status: 'Connected', isStudying: false, todayHours: 0, goalHours: 0, isRemoteConnection: true,
        })));
        setPeerCodeInput('');
        setFriendNotice({ type: 'success', message: `Connected with ${result.connection?.name || 'study partner'}. You can now compare study data.` });
      } catch (error) {
        setFriendNotice({ type: 'error', message: error.message });
      }
      return;
    }

    if (cleanCode === userInviteCode) {
      setFriendNotice({ type: 'error', message: 'You cannot duel with your own invite code.' });
      return;
    }

    if (friends.some((f) => f.code === cleanCode || f.name.toUpperCase() === cleanCode)) {
      setFriendNotice({ type: 'error', message: 'This partner is already in your study duel list.' });
      return;
    }

    const partnerName = cleanCode.startsWith('DUEL-')
      ? `Duelist ${cleanCode.slice(5)}`
      : cleanCode;

    const newPartner = {
      id: `friend-${Date.now()}`,
      name: partnerName,
      code: cleanCode,
      streakDays: 1,
      status: 'Connected · Idle',
      isStudying: false,
      todayHours: 0,
      goalHours: 4,
    };

    const updated = [newPartner, ...friends];
    setFriends(updated);
    try {
      localStorage.setItem(friendsKey, JSON.stringify(updated));
    } catch {}
    setPeerCodeInput('');
    setFriendNotice({
      type: 'success',
      message: `Duel initiated with ${partnerName}! Streak tracking active.`,
    });
    window.setTimeout(() => setFriendNotice(null), 3500);
  };

  const handleRemoveFriend = (id) => {
    if (user?.id) {
      fetch(`/api/connections/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'same-origin' })
        .then(async (response) => {
          const result = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(result.error || 'Could not remove this study partner.');
          setFriends((prev) => prev.filter((friend) => friend.id !== id));
        })
        .catch((error) => setFriendNotice({ type: 'error', message: error.message }));
      return;
    }
    const updated = friends.filter((f) => f.id !== id);
    setFriends(updated);
    try {
      localStorage.setItem(friendsKey, JSON.stringify(updated));
    } catch {}
  };

  // Timer mode definitions
  const timerModes = [
    {
      id: '25m',
      title: '25m Pomodoro',
      description: 'Short bursts + 5m break',
      badge: null,
    },
    {
      id: '50m',
      title: '50m Deep Work',
      description: 'Ideal for coding & math flow + 10m break',
      badge: 'Recommended',
    },
    {
      id: 'stopwatch',
      title: 'Open Stopwatch',
      description: 'Count-up open flow session',
      badge: null,
    },
  ];

  return (
    <div className="demo-settings-page" aria-label="StudyDuel Settings">
      {/* Back to timer navigation */}
      <button type="button" className="settings-back-btn" onClick={onBack}>
        <ArrowLeft size={15} />
        <span>Back to timer</span>
      </button>

      {/* Settings Header & 2-Tab Navigation */}
      <header className="demo-settings-heading">
        <div className="settings-header-top-row">
          <div>
            <h1>
              <Settings2 size={26} className="settings-header-icon" />
              <span>Settings</span>
            </h1>
            <p>Customize your study workspace, session defaults, and duel connections.</p>
          </div>

          <div className="settings-heading-actions">
          {/* Clean 2-Tab Architecture at top */}
          <div className="settings-tab-nav" role="tablist" aria-label="Settings sections">
            <button
              type="button"
              role="tab"
              id="tab-preferences"
              aria-selected={activeSettingsTab === 'preferences'}
              aria-controls="panel-preferences"
              className={`settings-tab-btn ${activeSettingsTab === 'preferences' ? 'active' : ''}`}
              onClick={() => setActiveSettingsTab('preferences')}
            >
              <Sliders size={15} />
              <span>Preferences</span>
            </button>
            <button
              type="button"
              role="tab"
              id="tab-connections"
              aria-selected={activeSettingsTab === 'connections'}
              aria-controls="panel-connections"
              className={`settings-tab-btn ${activeSettingsTab === 'connections' ? 'active' : ''}`}
              onClick={() => setActiveSettingsTab('connections')}
            >
              <Users size={15} />
              <span>Connections</span>
            </button>
          </div>
          {activeSettingsTab === 'preferences' && <div className="settings-save-wrap">
            <button type="button" className="settings-save-btn" onClick={saveSettings} disabled={saveStatus === 'saving'}>
              {saveStatus === 'saved' ? <Check size={15} /> : <Save size={15} />}
              <span>{saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved' : 'Save changes'}</span>
            </button>
            {saveStatus && saveStatus !== 'saved' && saveStatus !== 'saving' && <span className="settings-save-error" role="alert">{saveStatus}</span>}
          </div>}
          </div>
        </div>
      </header>

      {/* =========================================================================
          TAB 1: PREFERENCES
          ========================================================================= */}
      {activeSettingsTab === 'preferences' && (
        <div id="panel-preferences" role="tabpanel" aria-labelledby="tab-preferences">
          {/* CARD 1: Workspace, Profile & Theme Appearance Card */}
          <section className="settings-bento-card" aria-labelledby="card-workspace-title">
            <div className="settings-card-header">
              <div className="settings-card-title-group">
                <span className="settings-card-icon">
                  <User size={17} />
                </span>
                <h2 id="card-workspace-title">Workspace, Profile & Theme Appearance</h2>
              </div>
              <span className="settings-badge-pill">Profile & Display</span>
            </div>

            <div className="settings-row">
              <div className="settings-row-info">
                <strong>Time zone</strong>
                <span>Used for session dates, daily totals, and calendar views. Defaults to your computer’s time zone.</span>
              </div>
              <select className="settings-text-input settings-select-input" value={preferences.timezone} onChange={(e) => updatePreference('timezone', e.target.value)} aria-label="Time zone">
                {timezones.map((timezone) => <option key={timezone} value={timezone}>{timezone.replaceAll('_', ' ')}</option>)}
              </select>
            </div>

            {/* Display Name Input */}
            <div className="settings-row">
              <div className="settings-row-info">
                <strong>Display Name</strong>
                <span>Your public moniker and duelist handle across StudyDuel.</span>
              </div>
              <input
                type="text"
                value={preferences.displayName}
                onChange={(e) => updatePreference('displayName', e.target.value)}
                placeholder="e.g. Alex Rivera"
                className="settings-text-input"
                aria-label="Display Name"
              />
            </div>

            {/* Daily Study Goal Slider (1h to 12h, 0.5h steps, default 4h) */}
            <div className="settings-row">
              <div className="settings-row-info">
                <strong>Daily Study Goal</strong>
                <span>Target focus hours per day. Instantly updates your Dashboard progress ring.</span>
              </div>
              <div className="settings-slider-group">
                <input
                  type="range"
                  min="1"
                  max="12"
                  step="0.5"
                  value={preferences.dailyGoalHours}
                  onChange={(e) => updatePreference('dailyGoalHours', parseFloat(e.target.value))}
                  className="settings-range-slider"
                  aria-label="Daily study goal in hours"
                />
                <span className="settings-range-badge">
                  {preferences.dailyGoalHours}h
                </span>
              </div>
            </div>

            {/* Theme Appearance (3-Way Segmented Pill: Light, Dark, Auto-Daylight) */}
            <div className="settings-row">
              <div className="settings-row-info">
                <strong>Theme Appearance</strong>
                <span>
                  {themeMode === 'auto-daylight'
                    ? 'Auto-Daylight applies Light mode from 06:00–17:59 and Dark mode from 18:00–05:59.'
                    : 'Choose your desired aesthetic or let daylight guide your workspace.'}
                </span>
              </div>
              <div className="settings-segmented-group" role="radiogroup" aria-label="Theme mode selection">
                <button
                  type="button"
                  role="radio"
                  aria-checked={themeMode === 'light'}
                  className={`settings-segmented-btn ${themeMode === 'light' ? 'active' : ''}`}
                  onClick={() => { setThemeMode('light'); setSaveStatus(''); }}
                >
                  <Sun size={14} />
                  <span>Light</span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={themeMode === 'dark'}
                  className={`settings-segmented-btn ${themeMode === 'dark' ? 'active' : ''}`}
                  onClick={() => { setThemeMode('dark'); setSaveStatus(''); }}
                >
                  <Moon size={14} />
                  <span>Dark</span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={themeMode === 'auto-daylight'}
                  className={`settings-segmented-btn ${themeMode === 'auto-daylight' ? 'active accent-active' : ''}`}
                  onClick={() => { setThemeMode('auto-daylight'); setSaveStatus(''); }}
                >
                  <Sparkles size={14} />
                  <span>Auto-Daylight</span>
                </button>
              </div>
            </div>

            {/* Start of the Week */}
            <div className="settings-row">
              <div className="settings-row-info">
                <strong>Start of the Week</strong>
                <span>
                  Dashboard weekly summaries and charts begin on {preferences.weekStart}.
                </span>
              </div>
              <select className="settings-text-input settings-select-input" value={preferences.weekStart} onChange={(e) => updatePreference('weekStart', e.target.value)} aria-label="Start of the week">
                {weekDays.map((day) => <option key={day} value={day}>{day[0].toUpperCase() + day.slice(1)}</option>)}
              </select>
            </div>
          </section>

          {/* CARD 2: Default Timer Mode & Sound Effects Card */}
          <section className="settings-bento-card" aria-labelledby="card-timer-title">
            <div className="settings-card-header">
              <div className="settings-card-title-group">
                <span className="settings-card-icon">
                  <Clock3 size={17} />
                </span>
                <h2 id="card-timer-title">Default Timer Mode & Sound Effects</h2>
              </div>
              <span className="settings-badge-pill">Session Defaults</span>
            </div>

            {/* Default Session Length (3 Selectable Bento Cards) */}
            <div className="settings-mode-grid" role="radiogroup" aria-label="Default timer session length">
              {timerModes.map((mode) => {
                const isSelected = preferences.defaultTimerMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    className={`settings-mode-card ${isSelected ? 'active' : ''}`}
                    onClick={() => updatePreference('defaultTimerMode', mode.id)}
                  >
                    <div>
                      <div className="settings-mode-header">
                        <span className="settings-mode-title">{mode.title}</span>
                        {isSelected && (
                          <span className="settings-mode-check">
                            <Check size={12} strokeWidth={3} />
                          </span>
                        )}
                      </div>
                      <p className="settings-mode-desc">{mode.description}</p>
                    </div>
                    {mode.badge && <span className="settings-mode-rec-tag">{mode.badge}</span>}
                  </button>
                );
              })}
            </div>

            {/* Subtle Completion Chime (Web Audio API Synthesizer) */}
            <div className="settings-sound-row">
              <div className="settings-sound-copy">
                <span className="settings-sound-icon">
                  {preferences.soundEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
                </span>
                <div>
                  <strong>Completion Chime (Zen Bell)</strong>
                  <span>Synthesizes a calm 528Hz harmonic sine bell with a 1.3s exponential decay.</span>
                </div>
              </div>
              <div className="settings-sound-actions">
                <button
                  type="button"
                  className="settings-secondary-btn"
                  onClick={playZenBell}
                  disabled={!preferences.soundEnabled}
                  title="Test the 528Hz harmonic bell sound"
                >
                  <Volume2 size={14} />
                  <span>Test Sound</span>
                </button>
                <label className="settings-switch-label">
                  <span className="sr-only">Enable completion sound</span>
                  <input
                    type="checkbox"
                    checked={preferences.soundEnabled}
                    onChange={(e) => updatePreference('soundEnabled', e.target.checked)}
                  />
                  <span className="settings-switch" />
                </label>
              </div>
            </div>
          </section>

          {/* CARD 3: Export Study Logs (CSV / JSON) Card */}
          <section className="settings-bento-card" aria-labelledby="card-export-title">
            <div className="settings-export-row">
              <div className="settings-export-copy">
                <div className="settings-card-title-group">
                  <span className="settings-card-icon">
                    <Download size={17} />
                  </span>
                  <h2 id="card-export-title">Export Study Logs</h2>
                </div>
                <p>Download your raw study logs formatted for Pandas, Excel spreadsheets, or local JSON backup.</p>
              </div>
              <div className="settings-export-actions">
                <button
                  type="button"
                  className="settings-primary-btn"
                  onClick={exportCSV}
                  title="Download flat tabular CSV logs for Excel/Pandas"
                >
                  {exportStatus === 'csv' ? (
                    <>
                      <Check size={15} />
                      <span>Saved CSV</span>
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet size={15} />
                      <span>Export CSV (Recommended)</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  className="settings-secondary-btn"
                  onClick={exportJSON}
                  title="Download JSON array of session logs"
                >
                  {exportStatus === 'json' ? (
                    <>
                      <Check size={15} />
                      <span>Saved JSON</span>
                    </>
                  ) : (
                    <>
                      <FileJson size={15} />
                      <span>JSON</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* =========================================================================
          TAB 2: CONNECTIONS
          ========================================================================= */}
      {activeSettingsTab === 'connections' && (
        <div id="panel-connections" role="tabpanel" aria-labelledby="tab-connections">
          {/* CARD 1: Your StudyDuel Invite Code Card */}
          <section className="settings-bento-card" aria-labelledby="card-invite-title">
            <div className="settings-card-header">
              <div className="settings-card-title-group">
                <span className="settings-card-icon">
                  <UserPlus size={17} />
                </span>
                <h2 id="card-invite-title">Your StudyDuel Invite Code</h2>
              </div>
              <span className="settings-badge-pill">Peer Duels</span>
            </div>

            {/* Display unique code in monospace badge + Copy Button */}
            <div className="settings-invite-wrap">
              <div className="settings-row-info">
                <strong>Personal Duel Invite Code</strong>
                <span>Share this code with a study partner to connect profiles and compare study summaries.</span>
              </div>
              <div className="settings-invite-code-box">
                <span className="settings-monospace-code">{userInviteCode}</span>
                <button
                  type="button"
                  className={`settings-copy-btn ${copiedInvite ? 'copied' : ''}`}
                  onClick={copyInviteCode}
                  disabled={!userInviteCode}
                  title="Copy invite code to clipboard"
                >
                  {copiedInvite ? (
                    <>
                      <Check size={13} strokeWidth={2.5} />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy size={13} />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Add Friend Input + Button to initiate duel */}
            <div className="settings-add-friend-section">
              <div className="settings-row-info">
                <strong>Enter Peer Invite Code</strong>
                <span>Enter a partner's unique invite code to connect both profiles for Compare.</span>
              </div>
              <form className="settings-add-friend-form" onSubmit={handleAddFriend}>
                <input
                  type="text"
                  value={peerCodeInput}
                  onChange={(e) => setPeerCodeInput(e.target.value)}
                  placeholder="Enter peer's invite code (e.g., DUEL-1A2B3C4D5E)..."
                  className="settings-text-input"
                  aria-label="Peer invite code"
                />
                <button type="submit" className="settings-primary-btn" disabled={!peerCodeInput.trim()}>
                  <UserPlus size={15} />
                  <span>Connect</span>
                </button>
              </form>

              {friendNotice && (
                <div className={`settings-feedback-toast ${friendNotice.type}`} role="status">
                  {friendNotice.type === 'success' ? <Check size={14} /> : <X size={14} />}
                  <span>{friendNotice.message}</span>
                </div>
              )}
            </div>
          </section>

          {/* CARD 2: Connected Study Partners (Friend-Duel List) */}
          <section className="settings-bento-card" aria-labelledby="card-partners-title">
            <div className="settings-card-header">
              <div className="settings-card-title-group">
                <span className="settings-card-icon">
                  <Users size={17} />
                </span>
                <h2 id="card-partners-title">Connected Study Partners</h2>
              </div>
              <span className="settings-badge-pill">
                {friends.length} {friends.length === 1 ? 'Partner' : 'Partners'}
              </span>
            </div>

            {friends.length === 0 ? (
              <div className="settings-empty-partners">
                <p>No study partners connected yet.</p>
                <span>Enter a friend's invite code above to launch your first duel!</span>
              </div>
            ) : (
              <div className="settings-partners-list">
                {friends.map((friend) => {
                  const initial = (friend.name || 'D').charAt(0).toUpperCase();
                  const pct = Math.min(
                    100,
                    Math.round(((friend.todayHours || 0) / (friend.goalHours || 4)) * 100)
                  );

                  return (
                    <div key={friend.id} className="settings-partner-card">
                      {/* Left: Avatar initial, Display Name, Streak Badge, Status */}
                      <div className="settings-partner-left">
                        <div className="settings-partner-avatar" aria-hidden="true">
                          {initial}
                        </div>
                        <div className="settings-partner-info">
                          <div className="settings-partner-name-row">
                            <span className="settings-partner-name">{friend.name}</span>
                            <span
                              className="settings-streak-badge"
                              title={`${friend.streakDays || 1} day study streak`}
                            >
                              <Flame size={12} className="settings-flame-icon" />
                              <span>{friend.streakDays || 1}d</span>
                            </span>
                          </div>
                          <div className="settings-partner-status-row">
                            <span
                              className={`settings-status-dot ${friend.isStudying ? 'active' : ''}`}
                            />
                            <span className="settings-partner-status">{friend.status}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Today's Progress (todayHours / goalHours) with Progress Bar */}
                      <div className="settings-partner-right">
                        {friend.isRemoteConnection ? <span className="settings-progress-label">Compare data available</span> : <div className="settings-progress-group">
                          <span className="settings-progress-label">
                            <strong>{friend.todayHours}h</strong> / {friend.goalHours}h today
                          </span>
                          <div
                            className="settings-progress-track"
                            role="progressbar"
                            aria-valuenow={pct}
                            aria-valuemin="0"
                            aria-valuemax="100"
                            aria-label={`${friend.name} progress: ${pct}%`}
                          >
                            <div className="settings-progress-bar" style={{ width: `${pct}%` }} />
                          </div>
                        </div>}

                        <button
                          type="button"
                          className="settings-partner-remove-btn"
                          onClick={() => handleRemoveFriend(friend.id)}
                          title={`Disconnect ${friend.name}`}
                          aria-label={`Disconnect ${friend.name}`}
                        >
                          <X size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};
