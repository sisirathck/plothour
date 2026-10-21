import React, { useEffect, useState } from 'react';
import {
  ArrowLeft, Bell, CalendarDays, Check, Clock3, Download, FileJson,
  FileSpreadsheet, Settings2, Volume2, VolumeX,
} from 'lucide-react';
import { ThemeToggle } from '../../components/Header/ThemeToggle';
import './Settings.css';

const getUserKey = (user, suffix) => user?.id
  ? `studyduel_user_${user.id}_${suffix}`
  : `studyduel_demo_${suffix}`;

const defaultReminders = {
  dailyGoal: false, weeklyGoal: false, projectEstimate: false, longTimer: false,
  dailyTime: '20:00', weeklyTime: '18:00', longTimerHours: 3,
};

const readJson = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; }
  catch { return fallback; }
};

const downloadFile = (content, type, filename) => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

const csvCell = (value) => {
  const text = String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
};

export const SettingsPage = ({ onBack, user }) => {
  const remindersKey = getUserKey(user, 'reminders');
  const preferencesKey = getUserKey(user, 'preferences');
  const entriesKey = getUserKey(user, 'time_entries');
  const [reminders, setReminders] = useState(() => ({
    ...defaultReminders,
    ...readJson(remindersKey, {}),
  }));
  const [preferences, setPreferences] = useState(() => ({
    weekStart: 'monday',
    defaultTimerMode: '50m',
    soundEnabled: true,
    ...readJson(preferencesKey, {}),
  }));
  const [exportStatus, setExportStatus] = useState('');

  useEffect(() => {
    localStorage.setItem(remindersKey, JSON.stringify(reminders));
  }, [remindersKey, reminders]);

  useEffect(() => {
    localStorage.setItem(preferencesKey, JSON.stringify(preferences));
    window.dispatchEvent(new CustomEvent('studyduel:preferences-storage', {
      detail: { preferencesKey, preferences },
    }));
  }, [preferencesKey, preferences]);

  useEffect(() => {
    if (!exportStatus) return undefined;
    const timeout = window.setTimeout(() => setExportStatus(''), 2400);
    return () => window.clearTimeout(timeout);
  }, [exportStatus]);

  const updateReminder = (key, value) => setReminders((current) => ({ ...current, [key]: value }));
  const updatePreference = (key, value) => setPreferences((current) => ({ ...current, [key]: value }));

  const playChime = () => {
    if (!preferences.soundEnabled) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      const context = new AudioContextClass();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const now = context.currentTime;
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(528, now);
      oscillator.frequency.exponentialRampToValueAtTime(1056, now + 0.12);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.25);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + 1.25);
      oscillator.onended = () => context.close();
    } catch (error) {
      console.warn('Unable to play the completion chime.', error);
    }
  };

  const exportLogs = (format) => {
    const storedEntries = readJson(entriesKey, []);
    const entries = Array.isArray(storedEntries) ? storedEntries : [];
    const logs = entries.map((entry) => {
      const startedAt = entry.startedAt ? new Date(entry.startedAt) : null;
      return {
        session_id: entry.id || '',
        date: startedAt && !Number.isNaN(startedAt.getTime()) ? startedAt.toISOString().slice(0, 10) : '',
        day: startedAt && !Number.isNaN(startedAt.getTime()) ? startedAt.toLocaleDateString('en', { weekday: 'short' }) : '',
        project: entry.projectName || '',
        subject: entry.subjectName || '',
        duration_minutes: Math.round((Number(entry.durationSeconds) || 0) / 60),
        timer_mode: entry.mode || preferences.defaultTimerMode,
        completed: true,
      };
    });
    const dateStamp = new Date().toISOString().slice(0, 10);
    if (format === 'csv') {
      const fields = ['session_id', 'date', 'day', 'project', 'subject', 'duration_minutes', 'timer_mode', 'completed'];
      const csv = [fields.join(','), ...logs.map((log) => fields.map((field) => csvCell(log[field])).join(','))].join('\r\n');
      downloadFile(`\uFEFF${csv}`, 'text/csv;charset=utf-8;', `studyduel_logs_${dateStamp}.csv`);
    } else {
      downloadFile(JSON.stringify({ exported_at: new Date().toISOString(), logs }, null, 2), 'application/json', `studyduel_logs_${dateStamp}.json`);
    }
    setExportStatus(format);
  };

  const weekDays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const selectedWeekDay = weekDays.includes(preferences.weekStart) ? preferences.weekStart : 'monday';
  const weekLabel = `${selectedWeekDay[0].toUpperCase()}${selectedWeekDay.slice(1)}–${weekDays[(weekDays.indexOf(selectedWeekDay) + 6) % 7][0].toUpperCase()}${weekDays[(weekDays.indexOf(selectedWeekDay) + 6) % 7].slice(1)}`;
  const timerModes = [
    { id: '25m', title: '25m Pomodoro', description: 'Short focus blocks with a 5 minute break.' },
    { id: '50m', title: '50m Deep Work', description: 'A longer block for coding, reading, and problem solving.' },
    { id: 'stopwatch', title: 'Open Stopwatch', description: 'Track an open ended study session.' },
  ];

  return (
    <section className="demo-settings-page" aria-label="Application settings">
      <button type="button" className="settings-back-btn" onClick={onBack}>
        <ArrowLeft size={16} /><span>Back to timer</span>
      </button>

      <header className="demo-settings-heading">
        <span className="task-category-label">PREFERENCES</span>
        <h1><Settings2 size={26} /><span>Settings</span></h1>
        <p>Personalize your study week, timer defaults, sound, and data exports.</p>
      </header>

      <section className="settings-section" aria-labelledby="settings-workspace-title">
        <div className="settings-section-heading"><CalendarDays size={17} /><h2 id="settings-workspace-title">Calendar & Workspace</h2></div>
        <div className="settings-preference-row">
          <div><strong>Start of the Week</strong><span>Weekly charts use {weekLabel}. Choose any day to set your weekly cycle.</span></div>
          <div className="settings-weekday-select-wrap">
            <select className="settings-weekday-select" aria-label="Start of the week" value={selectedWeekDay} onChange={(event) => updatePreference('weekStart', event.target.value)}>
              {weekDays.map((day) => <option key={day} value={day}>{`${day[0].toUpperCase()}${day.slice(1)}`}</option>)}
            </select>
          </div>
        </div>
        <div className="demo-settings-row">
          <div><strong>Account Profile</strong><span>{user ? `Signed in as ${user.email}` : 'Using local demo guest account'}</span></div>
        </div>
        <div className="demo-settings-row">
          <div><strong>Appearance</strong><span>Switch between light and dark themes.</span></div>
          <ThemeToggle />
        </div>
        <div className="demo-settings-row">
          <div><strong>Timezone</strong><span>{user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'}</span></div>
        </div>
      </section>

      <section className="settings-section" aria-labelledby="settings-timer-title">
        <div className="settings-section-heading"><Clock3 size={17} /><h2 id="settings-timer-title">Default Timer Mode</h2><span className="settings-recommended">50m recommended</span></div>
        <div className="settings-mode-grid">
          {timerModes.map((mode) => (
            <button key={mode.id} type="button" className={`settings-mode-card${preferences.defaultTimerMode === mode.id ? ' selected' : ''}`} aria-pressed={preferences.defaultTimerMode === mode.id} onClick={() => updatePreference('defaultTimerMode', mode.id)}>
              <span className="settings-mode-title">{mode.title}{preferences.defaultTimerMode === mode.id && <Check size={15} />}</span>
              <span className="settings-mode-description">{mode.description}</span>
            </button>
          ))}
        </div>
        <div className="settings-preference-row settings-sound-row">
          <div className="settings-sound-copy">
            {preferences.soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            <div><strong>Zen Harmonic Bell</strong><span>Soft 528 Hz chime when you test the sound.</span></div>
          </div>
          <div className="settings-sound-actions">
            <button type="button" className="settings-secondary-btn" onClick={playChime} disabled={!preferences.soundEnabled}>Test sound</button>
            <label className="settings-switch-label"><span className="sr-only">Enable completion sound</span><input type="checkbox" checked={preferences.soundEnabled} onChange={(event) => updatePreference('soundEnabled', event.target.checked)} /><span className="settings-switch" /></label>
          </div>
        </div>
      </section>

      <section className="settings-section settings-export" aria-labelledby="settings-export-title">
        <div className="settings-export-copy"><div className="settings-section-heading"><Download size={17} /><h2 id="settings-export-title">Export Study Logs</h2><span className="settings-recommended">CSV recommended</span></div><p>Export your saved sessions for spreadsheets, Pandas, or JSON backups.</p></div>
        <div className="settings-export-actions">
          <button type="button" className="settings-primary-btn" onClick={() => exportLogs('csv')}><FileSpreadsheet size={16} />{exportStatus === 'csv' ? 'CSV downloaded' : 'Export CSV'}</button>
          <button type="button" className="settings-secondary-btn" onClick={() => exportLogs('json')}><FileJson size={16} />{exportStatus === 'json' ? 'JSON downloaded' : 'Export JSON'}</button>
        </div>
      </section>

      <section className="settings-reminders" aria-labelledby="settings-reminders-title">
        <div className="settings-reminders-heading"><span className="settings-reminders-icon"><Bell size={17} /></span><div><h2 id="settings-reminders-title">Gentle reminders</h2><p>In-app only. Choose which nudges you want; each can be turned off anytime.</p></div></div>
        <label className="settings-reminder-option"><span><strong>Daily goal check-in</strong><small>Remind me if I am short of today's study goal.</small></span><input type="checkbox" checked={reminders.dailyGoal} onChange={(event) => updateReminder('dailyGoal', event.target.checked)} /></label>
        {reminders.dailyGoal && <label className="settings-reminder-time">Check after<input type="time" value={reminders.dailyTime} onChange={(event) => updateReminder('dailyTime', event.target.value)} /></label>}
        <label className="settings-reminder-option"><span><strong>Weekly goal check-in</strong><small>On Saturday, remind me if I am short of my weekly goal.</small></span><input type="checkbox" checked={reminders.weeklyGoal} onChange={(event) => updateReminder('weeklyGoal', event.target.checked)} /></label>
        {reminders.weeklyGoal && <label className="settings-reminder-time">Check after<input type="time" value={reminders.weeklyTime} onChange={(event) => updateReminder('weeklyTime', event.target.value)} /></label>}
        <label className="settings-reminder-option"><span><strong>Project estimate</strong><small>Let me know when a project reaches 80% of its planned time.</small></span><input type="checkbox" checked={reminders.projectEstimate} onChange={(event) => updateReminder('projectEstimate', event.target.checked)} /></label>
        <label className="settings-reminder-option"><span><strong>Long-running timer</strong><small>Catch a timer that may have been left running.</small></span><input type="checkbox" checked={reminders.longTimer} onChange={(event) => updateReminder('longTimer', event.target.checked)} /></label>
        {reminders.longTimer && <label className="settings-reminder-time">Remind me after<select value={reminders.longTimerHours} onChange={(event) => updateReminder('longTimerHours', Number(event.target.value))}><option value="2">2 hours</option><option value="3">3 hours</option><option value="4">4 hours</option><option value="6">6 hours</option></select></label>}
      </section>

      <p className="demo-settings-note">Settings are saved in this browser for this account. Reminder choices appear while StudyDuel is open.</p>
    </section>
  );
};
