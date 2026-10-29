import { WorkspaceBackup } from './WorkspaceBackup';
import { ComparisonSharing } from './ComparisonSharing';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileJson,
  FileSpreadsheet,
  Flame,
  Loader2,
  Lock,
  Moon,
  Settings2,
  Save,
  Search,
  Sliders,
  Sparkles,
  Sun,
  User,
  UserMinus,
  UserPlus,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { getSiteFontStyle, useSiteCustomization } from '../../context/SiteCustomizationContext';
import {
  DateFormatPicker,
  TimezonePicker,
  csvCell,
  downloadFile,
  getUserKey,
  playZenBell,
  readJson,
} from './SettingsSupport';
import './Settings.css';

export const SettingsPage = ({ user }) => {
  const { config } = useSiteCustomization();
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
  const [settingsSearch, setSettingsSearch] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem('studyduel_settings_tab', activeSettingsTab);
    } catch {}
  }, [activeSettingsTab]);

  useEffect(() => {
    const panel = document.getElementById(`panel-${activeSettingsTab}`);
    if (!panel) return;
    const query = settingsSearch.trim().toLocaleLowerCase();
    panel.querySelectorAll('.settings-bento-card').forEach((card) => {
      const cardMatches = !query || card.innerText.toLocaleLowerCase().includes(query);
      card.hidden = !cardMatches;
      if (!query || !cardMatches) return;
      const rows = card.querySelectorAll('.settings-row');
      rows.forEach((row) => { row.hidden = !row.innerText.toLocaleLowerCase().includes(query); });
    });
    return () => panel.querySelectorAll('.settings-bento-card,.settings-row').forEach((item) => { item.hidden = false; });
  }, [settingsSearch, activeSettingsTab]);

  // Tab 1: Preferences State
  const [preferences, setPreferences] = useState(() => {
    const saved = readJson(preferencesKey, {});
    // Daily targets are configured on each project/subproject plan now.
    // Drop the former global setting so it cannot override those schedules.
    delete saved.dailyGoalHours;
    const isLegacyTimerDefault = !saved.timerDefaultModeVersion && saved.defaultTimerMode === '50m';
    return {
      weekStart: weekDays[Number.isInteger(user?.week_starts_on) ? user.week_starts_on : 1] || 'monday',
      timezone: systemTimezone,
      dateFormat: 'system',
      defaultTimerMode: isLegacyTimerDefault ? 'stopwatch' : saved.defaultTimerMode || 'stopwatch',
      timerDefaultModeVersion: 2,
      soundEnabled: true,
      ...saved,
      defaultTimerMode: isLegacyTimerDefault ? 'stopwatch' : saved.defaultTimerMode || 'stopwatch',
      timerDefaultModeVersion: 2,
      // The account profile is shared with connections; stale local preferences
      // must not mask the public display name stored on the account.
      displayName: user?.display_name || saved.displayName || user?.email?.split('@')[0] || 'Alex Rivera',
    };
  });
  const savedPreferencesRef = useRef(preferences);
  const hasUnsavedChanges = JSON.stringify(preferences) !== JSON.stringify(savedPreferencesRef.current);

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
      savedPreferencesRef.current = preferences;
      setSaveStatus('saved');
    } catch (error) {
      console.error('Could not save settings:', error);
      setSaveStatus(error.message || 'error');
    }
  };

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState(''); // '' | 'saving' | 'saved'
  const [passwordError, setPasswordError] = useState('');

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordStatus('');

    if (user?.has_password && !currentPassword) {
      setPasswordError('Please enter your current password.');
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match. Please verify both fields.');
      return;
    }

    setPasswordStatus('saving');
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not change password.');
      }
      setPasswordStatus('saved');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordStatus(''), 4000);
    } catch (err) {
      setPasswordError(err.message);
      setPasswordStatus('');
    }
  };

  // Export logs feedback state
  const [exportStatus, setExportStatus] = useState('');
  const [exportPreview, setExportPreview] = useState('');
  const [importPreview, setImportPreview] = useState(null);
  const [importError, setImportError] = useState('');
  const importFileRef = useRef(null);

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
      const timerMode = entry.mode || preferences.defaultTimerMode || 'stopwatch';
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
        timer_mode: entry.mode || preferences.defaultTimerMode || 'stopwatch',
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

  const previewImport = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!Array.isArray(parsed)) throw new Error('Choose a PlotHour JSON export containing a list of sessions.');
      const converted = parsed.map((row) => {
        const date = /^\d{4}-\d{2}-\d{2}$/.test(String(row.date || '')) ? new Date(`${row.date}T12:00:00`) : new Date(row.startedAt);
        const durationSeconds = Math.round(Number(row.duration_minutes ?? (Number(row.durationSeconds) / 60)) * 60);
        if (!Number.isFinite(date.getTime()) || durationSeconds <= 0) return null;
        const startedAt = row.startedAt != null && Number.isFinite(Number(row.startedAt)) ? Number(row.startedAt) : date.getTime();
        const projectName = row.project || row.projectName || 'General Study';
        const id = row.session_id || row.id || `import-${date.toISOString().slice(0, 10)}-${durationSeconds}-${projectName.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
        return { id, startedAt, endedAt: startedAt + durationSeconds * 1000, durationSeconds, projectName, projectId: row.projectId || '', subjectName: row.subject || row.subjectName || '', subjectId: row.subjectId || '', mode: row.timer_mode || row.mode || '50m', note: row.note || '' };
      }).filter(Boolean);
      if (!converted.length) throw new Error('No valid sessions were found. Each record needs a date and a duration greater than zero.');
      setImportError('');
      setImportPreview(converted);
    } catch (error) { setImportError(error.message || 'Could not read that file.'); }
  };
  const confirmImport = () => {
    if (!importPreview) return;
    const existing = readJson(entriesKey, []);
    const keys = new Set(existing.map((entry) => `${entry.id}|${entry.startedAt}|${entry.durationSeconds}`));
    const added = [];
    importPreview.forEach((entry) => { const key = `${entry.id}|${entry.startedAt}|${entry.durationSeconds}`; if (!keys.has(key)) { keys.add(key); added.push(entry); } });
    localStorage.setItem(entriesKey, JSON.stringify([...added, ...existing]));
    window.dispatchEvent(new CustomEvent('studyduel:timer-storage', { detail: { entriesKey, activeTimerKey: getUserKey(user, 'active_timer') } }));
    setImportPreview(null);
    setImportError(added.length ? `${added.length} sessions imported.` : 'Those sessions are already in your history.');
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
  const [friendPendingRemoval, setFriendPendingRemoval] = useState(null);
  const friendRemoveCancelRef = useRef(null);

  useEffect(() => {
    if (!friendPendingRemoval) return undefined;
    const previousFocus = document.activeElement;
    friendRemoveCancelRef.current?.focus();
    const handleDialogKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setFriendPendingRemoval(null);
      } else if (event.key === 'Tab') {
        const buttons = Array.from(document.querySelectorAll('.settings-confirm-dialog button:not(:disabled)'));
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', handleDialogKeyDown);
    return () => {
      document.removeEventListener('keydown', handleDialogKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [friendPendingRemoval]);

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
          message: 'This invite code is out of date. Current codes look like DUEL-1A2B3C4D5E; copy the code shown in Settings after refreshing PlotHour.',
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
      setFriendNotice({ type: 'error', message: 'This partner is already in your PlotHour partner list.' });
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
          window.dispatchEvent(new CustomEvent('studyduel:connection-removed', { detail: { id: String(id) } }));
        })
        .catch((error) => setFriendNotice({ type: 'error', message: error.message }));
      return;
    }
    const updated = friends.filter((f) => f.id !== id);
    setFriends(updated);
    try {
      localStorage.setItem(friendsKey, JSON.stringify(updated));
      const compareProfiles = readJson('studyduel_demo_compare_profiles', []).filter((profile) => String(profile.id) !== String(id));
      const selectedProfiles = readJson('studyduel_demo_compare_profiles_selected', []).filter((profileId) => String(profileId) !== String(id));
      localStorage.setItem('studyduel_demo_compare_profiles', JSON.stringify(compareProfiles));
      localStorage.setItem('studyduel_demo_compare_profiles_selected', JSON.stringify(selectedProfiles));
    } catch {}
    window.dispatchEvent(new CustomEvent('studyduel:connection-removed', { detail: { id: String(id) } }));
  };

  const confirmRemoveFriend = () => {
    if (!friendPendingRemoval) return;
    handleRemoveFriend(friendPendingRemoval.id);
    setFriendPendingRemoval(null);
  };

  return (
    <div className="demo-settings-page" aria-label="PlotHour Settings" style={getSiteFontStyle(config, 'settings')}>
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
          <label className="settings-quick-search"><Search size={15} /><input type="search" value={settingsSearch} onChange={(event) => setSettingsSearch(event.target.value)} placeholder="Search settings" aria-label="Search settings" /></label>
          </div>
        </div>
      </header>

      {/* =========================================================================
          TAB 1: PREFERENCES
          ========================================================================= */}
      {activeSettingsTab === 'preferences' && (
        <div id="panel-preferences" role="tabpanel" aria-labelledby="tab-preferences">
          <WorkspaceBackup user={user} />
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
              <TimezonePicker value={preferences.timezone} timezones={timezones} onChange={(value) => updatePreference('timezone', value)} />
            </div>

            <div className="settings-row">
              <div className="settings-row-info">
                <strong>Date format</strong>
                <span>Choose how dates appear across your study workspace.</span>
              </div>
              <DateFormatPicker value={preferences.dateFormat} onChange={(value) => updatePreference('dateFormat', value)} />
            </div>

            {/* Display Name Input */}
            <div className="settings-row">
              <div className="settings-row-info">
                <strong>Display Name</strong>
                <span>Your public moniker and duelist handle across PlotHour.</span>
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

          {/* CARD: Account Security & Password */}
          <section className="settings-bento-card" aria-labelledby="card-security-title">
            <div className="settings-card-header">
              <div className="settings-card-title-group">
                <span className="settings-card-icon">
                  <Lock size={17} />
                </span>
                <h2 id="card-security-title">Account Security & Password</h2>
              </div>
              <span className="settings-badge-pill">Security</span>
            </div>

            {!user?.id ? (
              <div className="settings-row">
                <div className="settings-row-info">
                  <strong>Sign-in account required</strong>
                  <span>You are exploring PlotHour in demo mode. Sign in or register an account to manage your password.</span>
                </div>
              </div>
            ) : (
              <form className="settings-password-form" onSubmit={handlePasswordChange}>
                {user.has_password ? (
                  <div className="settings-row">
                    <div className="settings-row-info">
                      <strong>Current Password</strong>
                      <span>Enter your existing account password to confirm your identity.</span>
                    </div>
                    <div className="settings-password-input-wrap">
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => { setCurrentPassword(e.target.value); setPasswordError(''); }}
                        placeholder="Current password"
                        className="settings-text-input"
                        autoComplete="current-password"
                        required
                      />
                      <button
                        type="button"
                        className="settings-eye-btn"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                        tabIndex={-1}
                      >
                        {showCurrentPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="settings-row">
                    <div className="settings-row-info">
                      <strong>Google Account Linked</strong>
                      <span>Your account currently uses Google sign-in. You can set a password below to enable direct email and password login.</span>
                    </div>
                  </div>
                )}

                <div className="settings-row">
                  <div className="settings-row-info">
                    <strong>New Password</strong>
                    <span>Must be at least 8 characters long.</span>
                  </div>
                  <div className="settings-password-input-wrap">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => { setNewPassword(e.target.value); setPasswordError(''); }}
                      placeholder="At least 8 characters"
                      className="settings-text-input"
                      autoComplete="new-password"
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      className="settings-eye-btn"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                      tabIndex={-1}
                    >
                      {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div className="settings-row">
                  <div className="settings-row-info">
                    <strong>Confirm New Password</strong>
                    <span>Re-enter the new password to confirm.</span>
                  </div>
                  <div className="settings-password-input-wrap">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); setPasswordError(''); }}
                      placeholder="Re-enter new password"
                      className="settings-text-input"
                      autoComplete="new-password"
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      className="settings-eye-btn"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {passwordError && (
                  <div className="settings-password-msg error" role="alert">
                    {passwordError}
                  </div>
                )}

                {passwordStatus === 'saved' && (
                  <div className="settings-password-msg success" role="status">
                    <Check size={14} /> Password updated successfully!
                  </div>
                )}

                <div className="settings-password-actions">
                  <button
                    type="submit"
                    className="settings-primary-btn"
                    disabled={passwordStatus === 'saving' || !newPassword || !confirmPassword || (user.has_password && !currentPassword)}
                  >
                    {passwordStatus === 'saving' ? (
                      <>
                        <Loader2 className="animate-spin" size={15} />
                        <span>Saving password…</span>
                      </>
                    ) : (
                      <>
                        <Lock size={15} />
                        <span>{user.has_password ? 'Update password' : 'Set password'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </section>

          {/* CARD 2: Session notification sound */}
          <section className="settings-bento-card" aria-labelledby="card-timer-title">
            <div className="settings-card-header">
              <div className="settings-card-title-group">
                <span className="settings-card-icon">
                  <Volume2 size={17} />
                </span>
                <h2 id="card-timer-title">Notification Sound</h2>
              </div>
            </div>

            {/* Subtle Completion Chime (Web Audio API Synthesizer) */}
            <div className="settings-sound-row">
              <div className="settings-sound-copy">
                <span className="settings-sound-icon">
                  {preferences.soundEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
                </span>
                <div>
                  <strong>Completion Chime</strong>
                  <span>Play a gentle chime when a study session ends.</span>
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
                <input ref={importFileRef} type="file" accept="application/json,.json" onChange={previewImport} className="settings-import-file" aria-label="Import PlotHour JSON study logs" />
                <button type="button" className="settings-secondary-btn" onClick={() => { setImportError(''); importFileRef.current?.click(); }}><Download size={15} /> Import JSON</button>
                <button
                  type="button"
                  className="settings-primary-btn"
                  onClick={() => setExportPreview('csv')}
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
                  onClick={() => setExportPreview('json')}
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
            {importError && <p className="settings-import-feedback" role="status">{importError}</p>}
          </section>
          {hasUnsavedChanges && <div className="settings-save-dock">
            <div className="settings-save-wrap">
              {saveStatus && saveStatus !== 'saving' && <span className="settings-save-error" role="alert">{saveStatus}</span>}
              <button type="button" className="settings-save-btn" onClick={saveSettings} disabled={saveStatus === 'saving'}>
                <Save size={15} />
                <span>{saveStatus === 'saving' ? 'Saving…' : 'Save changes'}</span>
              </button>
            </div>
          </div>}
        </div>
      )}

      {/* =========================================================================
          TAB 2: CONNECTIONS
          ========================================================================= */}
      {activeSettingsTab === 'connections' && (
        <div id="panel-connections" role="tabpanel" aria-labelledby="tab-connections">
          <ComparisonSharing user={user} />
          {/* CARD 1: Your PlotHour Invite Code Card */}
          <section className="settings-bento-card" aria-labelledby="card-invite-title">
            <div className="settings-card-header">
              <div className="settings-card-title-group">
                <span className="settings-card-icon">
                  <UserPlus size={17} />
                </span>
                <h2 id="card-invite-title">Your PlotHour Invite Code</h2>
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
                          onClick={() => setFriendPendingRemoval(friend)}
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
      {friendPendingRemoval && <div className="settings-confirm-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setFriendPendingRemoval(null); }}>
        <section className="settings-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="settings-disconnect-title" aria-describedby="settings-disconnect-description">
          <div className="settings-confirm-icon"><UserMinus size={20} /></div>
          <button type="button" className="settings-confirm-close" aria-label="Cancel disconnect" onClick={() => setFriendPendingRemoval(null)}><X size={17} /></button>
          <span className="settings-confirm-eyebrow">STUDY PARTNER</span>
          <h2 id="settings-disconnect-title">Disconnect {friendPendingRemoval.name}?</h2>
          <p id="settings-disconnect-description">This will remove {friendPendingRemoval.name} from your connected study partners. You can connect again later with an invite code.</p>
          <div className="settings-confirm-actions">
            <button type="button" className="settings-secondary-btn" ref={friendRemoveCancelRef} onClick={() => setFriendPendingRemoval(null)}>Keep connected</button>
            <button type="button" className="settings-danger-btn" onClick={confirmRemoveFriend}><UserMinus size={15} /> Disconnect</button>
          </div>
        </section>
      </div>}
      {exportPreview && <div className="settings-export-preview-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setExportPreview(''); }}>
        <section className="settings-export-preview" role="dialog" aria-modal="true" aria-labelledby="settings-export-preview-title">
          <div className="settings-export-preview-heading"><div><span>YOUR DATA</span><h2 id="settings-export-preview-title">Review export</h2></div><button type="button" aria-label="Close export preview" onClick={() => setExportPreview('')}><X size={18} /></button></div>
          <p>This file contains {readJson(entriesKey, []).length} study sessions. Session notes and account connection details are not included.</p>
          <div className="settings-export-columns"><strong>{exportPreview === 'csv' ? 'CSV columns' : 'JSON fields'}</strong><span>Session ID · Date · Day · Project · Duration · Timer mode · Completed</span></div>
          <div className="settings-export-sample"><strong>Preview</strong><code>{readJson(entriesKey, []).slice(0, 3).map((entry) => `${formatDisplayDate(new Date(entry.startedAt), { month: 'short', day: 'numeric', year: 'numeric' })} · ${entry.projectName || entry.project || 'General Study'} · ${Math.round((Number(entry.durationSeconds) || 0) / 60)} min`).join('\n') || 'No sessions to export yet'}</code></div>
          <div className="settings-export-preview-actions"><button type="button" className="settings-secondary-btn" onClick={() => setExportPreview('')}>Cancel</button><button type="button" className="settings-primary-btn" onClick={() => { const type = exportPreview; setExportPreview(''); if (type === 'csv') exportCSV(); else exportJSON(); }}>{exportPreview === 'csv' ? <FileSpreadsheet size={15} /> : <FileJson size={15} />} Download {exportPreview.toUpperCase()}</button></div>
        </section>
      </div>}
      {importPreview && <div className="settings-export-preview-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setImportPreview(null); }}>
        <section className="settings-export-preview" role="dialog" aria-modal="true" aria-labelledby="settings-import-preview-title">
          <div className="settings-export-preview-heading"><div><span>MERGE STUDY LOGS</span><h2 id="settings-import-preview-title">Review import</h2></div><button type="button" aria-label="Close import preview" onClick={() => setImportPreview(null)}><X size={18} /></button></div>
          <p>{importPreview.length} valid sessions are ready to merge into your history. Existing logs are kept; duplicate session IDs are skipped.</p>
          <div className="settings-export-sample"><strong>Preview · dates without times are placed at noon</strong><code>{importPreview.slice(0, 5).map((entry) => `${formatDisplayDate(new Date(entry.startedAt), { month: 'short', day: 'numeric', year: 'numeric' })} · ${entry.projectName} · ${Math.round(entry.durationSeconds / 60)} min`).join('\n')}</code></div>
          <div className="settings-export-preview-actions"><button type="button" className="settings-secondary-btn" onClick={() => setImportPreview(null)}>Cancel</button><button type="button" className="settings-primary-btn" onClick={confirmImport}><Check size={15} /> Merge sessions</button></div>
        </section>
      </div>}
    </div>
  );
};
