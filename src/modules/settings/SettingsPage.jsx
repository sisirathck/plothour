import React from 'react';
import { ArrowLeft, Settings2 } from 'lucide-react';
import { ThemeToggle } from '../../components/Header/ThemeToggle';
import './Settings.css';

export const SettingsPage = ({ onBack, user }) => (
  <section className="demo-settings-page" aria-label="Application settings">
    <button type="button" className="settings-back-btn" onClick={onBack}>
      <ArrowLeft size={16} />
      <span>Back to timer</span>
    </button>

    <header className="demo-settings-heading">
      <span className="task-category-label">PREFERENCES</span>
      <h1>
        <Settings2 size={26} />
        <span>Settings</span>
      </h1>
      <p>Personalize your StudyDuel experience.</p>
    </header>

    <div className="demo-settings-row">
      <div>
        <strong>Account Profile</strong>
        <span>{user ? `Signed in as ${user.email}` : 'Using local demo guest account'}</span>
      </div>
    </div>

    <div className="demo-settings-row">
      <div>
        <strong>Appearance</strong>
        <span>Switch between light and dark themes.</span>
      </div>
      <ThemeToggle />
    </div>

    <div className="demo-settings-row">
      <div>
        <strong>Timezone</strong>
        <span>{user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'}</span>
      </div>
    </div>

    <p className="demo-settings-note">
      {user
        ? 'Your account preferences and tracked time are securely synchronized with PostgreSQL.'
        : 'You are currently viewing StudyDuel in demo mode. Your data is stored locally in this browser.'}
    </p>
  </section>
);
