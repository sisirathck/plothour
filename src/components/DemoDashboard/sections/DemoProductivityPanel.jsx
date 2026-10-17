import React from 'react';
import { BarChart3, CheckCircle2, ChevronRight, Clock, Flame } from 'lucide-react';

const metrics = [
  { icon: Clock, tone: 'orange', value: '5h 24m', label: 'Total Tracked' },
  { icon: Flame, tone: 'fire', value: '12 Days', label: 'Duel Streak' },
  { icon: CheckCircle2, tone: 'green', value: '94.8%', label: 'Focus Ratio' },
];

const subjects = [
  { name: 'CS 301 Algorithms', duration: '2h 45m', width: '55%', color: 'alg' },
  { name: 'Math 220 Linear Algebra', duration: '1h 30m', width: '30%', color: 'math' },
];

export const DemoProductivityPanel = () => (
  <section className="metrics-summary-card" aria-labelledby="demo-productivity-title">
    <div className="section-header">
      <div className="header-title-group">
        <BarChart3 className="section-icon" size={20} />
        <h3 id="demo-productivity-title">Daily Productivity</h3>
      </div>
      <span className="date-badge">Today</span>
    </div>

    <div className="metric-tiles-row">
      {metrics.map(({ icon: Icon, tone, value, label }) => (
        <div className="metric-tile" key={label}>
          <div className={`tile-icon-wrapper ${tone}`}><Icon size={18} /></div>
          <div className="tile-content">
            <span className="tile-value">{value}</span>
            <span className="tile-title">{label}</span>
          </div>
        </div>
      ))}
    </div>

    <div className="subject-breakdown">
      <div className="breakdown-header">
        <span>Subject Distribution</span>
        <span className="view-all">Details <ChevronRight size={13} /></span>
      </div>
      <div className="breakdown-bars">
        {subjects.map(({ name, duration, width, color }) => (
          <div className="breakdown-item" key={name}>
            <div className="item-label-row">
              <span>{name}</span>
              <span className="duration">{duration}</span>
            </div>
            <div className="progress-bg">
              <div className={`progress-fill ${color}`} style={{ width }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);
