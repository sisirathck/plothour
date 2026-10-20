import React, { useEffect, useState } from 'react';
import { ArrowLeft, Bell, Settings2 } from 'lucide-react';
import { ThemeToggle } from '../../components/Header/ThemeToggle';
import './Settings.css';

const getReminderKey = (user) => user?.id ? `studyduel_user_${user.id}_reminders` : 'studyduel_demo_reminders';
const defaultReminders = { dailyGoal: false, weeklyGoal: false, projectEstimate: false, longTimer: false, dailyTime: '20:00', weeklyTime: '18:00', longTimerHours: 3 };

export const SettingsPage = ({ onBack, user }) => {
  const reminderKey = getReminderKey(user);
  const [reminders, setReminders] = useState(() => {
    try { return { ...defaultReminders, ...(JSON.parse(localStorage.getItem(reminderKey) || 'null') || {}) }; }
    catch { return defaultReminders; }
  });
  useEffect(() => { localStorage.setItem(reminderKey, JSON.stringify(reminders)); }, [reminderKey, reminders]);
  const updateReminder = (key, value) => setReminders((current) => ({ ...current, [key]: value }));

  return (
    <section className="demo-settings-page" aria-label="Application settings">
      <button type="button" className="settings-back-btn" onClick={onBack}>
        <ArrowLeft size={16} />
        <span>Back to timer</span>
      </button>

      <header className="demo-settings-heading">
        <span className="task-category-label">PREFERENCES</span>
        <h1><Settings2 size={26} /><span>Settings</span></h1>
        <p>Personalize your StudyDuel experience.</p>
      </header>

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

      <p className="demo-settings-note">Reminder choices are saved in this browser and appear while StudyDuel is open. No device notifications are requested.</p>
    </section>
  );
};
