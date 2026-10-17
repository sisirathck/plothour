import React from 'react';
import { ArrowLeft, Settings2 } from 'lucide-react';
import { ThemeToggle } from '../../Header/ThemeToggle';

export const DemoSettingsPage = ({ onBack }) => (
  <section className="demo-settings-page">
    <button type="button" className="settings-back-btn" onClick={onBack}><ArrowLeft size={16} /> Back to dashboard</button>
    <header className="demo-settings-heading">
      <span className="task-category-label">PREFERENCES</span>
      <h1><Settings2 size={25} /> Settings</h1>
      <p>Personalize your StudyDuel experience.</p>
    </header>
    <div className="demo-settings-row">
      <div><strong>Appearance</strong><span>Switch between light and dark themes.</span></div>
      <ThemeToggle />
    </div>
    <div className="demo-settings-note">You’re viewing the interactive guest demo. Your settings are stored in this browser.</div>
  </section>
);
