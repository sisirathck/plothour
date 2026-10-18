import React, { useState, useEffect, useMemo } from 'react';
import { BarChart3, CheckCircle2, Clock, Flame, FolderKanban, Target, TrendingUp } from 'lucide-react';
import './Dashboard.css';

const formatDuration = (totalSeconds) => {
  if (!totalSeconds || totalSeconds <= 0) return '0m';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

const isEntryInRange = (entry, range) => {
  if (!entry?.startedAt) return false;
  const entryDate = new Date(entry.startedAt);
  const now = new Date();

  if (range === 'today') {
    return entryDate.toDateString() === now.toDateString();
  }

  if (range === 'week') {
    const startOfWeek = new Date(now);
    const day = (now.getDay() + 6) % 7;
    startOfWeek.setDate(now.getDate() - day);
    startOfWeek.setHours(0, 0, 0, 0);
    return entryDate >= startOfWeek;
  }

  if (range === 'month') {
    return entryDate.getFullYear() === now.getFullYear() && entryDate.getMonth() === now.getMonth();
  }

  return true;
};

const calculateStreak = (entries) => {
  if (!entries || entries.length === 0) return 0;

  const activeDates = new Set();
  entries.forEach((e) => {
    if (e.durationSeconds > 0 && e.startedAt) {
      const d = new Date(e.startedAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      activeDates.add(key);
    }
  });

  if (activeDates.size === 0) return 0;

  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

  let checkDate;
  if (activeDates.has(todayKey)) {
    checkDate = new Date(now);
  } else if (activeDates.has(yesterdayKey)) {
    checkDate = yesterday;
  } else {
    return 0;
  }

  let streak = 0;
  while (true) {
    const key = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
    if (activeDates.has(key)) {
      streak += 1;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
};

const getBestProductivityWindow = (entries) => {
  const todayEntries = entries.filter((e) => isEntryInRange(e, 'today'));
  if (todayEntries.length === 0) return null;

  const hourBuckets = new Array(24).fill(0);
  todayEntries.forEach((e) => {
    const startHour = new Date(e.startedAt).getHours();
    hourBuckets[startHour] += (e.durationSeconds || 0);
  });

  let maxHour = -1;
  let maxSecs = 0;
  for (let h = 0; h < 24; h++) {
    if (hourBuckets[h] > maxSecs) {
      maxSecs = hourBuckets[h];
      maxHour = h;
    }
  }

  if (maxHour === -1 || maxSecs === 0) return null;

  const formatHour = (h) => {
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:00 ${period}`;
  };

  return `${formatHour(maxHour)} – ${formatHour((maxHour + 1) % 24)}`;
};

const demoMetrics = [
  { icon: Clock, tone: 'orange', value: '5h 24m', label: 'Total Tracked Today' },
  { icon: Flame, tone: 'fire', value: '12 Days', label: 'Personal Streak' },
  { icon: CheckCircle2, tone: 'green', value: '94.8%', label: 'Focus Ratio' },
  { icon: Target, tone: 'purple', value: '4h 00m', label: 'Daily Goal Target' },
];

const demoSubjects = [
  { name: 'Computer Science · Algorithms', duration: '2h 45m', width: '60%', color: '#f97316' },
  { name: 'Computer Science · Data Structures', duration: '1h 30m', width: '35%', color: '#3b82f6' },
  { name: 'Languages · Japanese', duration: '1h 09m', width: '25%', color: '#10b981' },
];

export const DashboardPage = ({ user, onNavigate }) => {
  const [activeRange, setActiveRange] = useState('today');

  const entriesKey = user?.id ? `studyduel_user_${user.id}_time_entries` : 'studyduel_demo_time_entries';

  const [entries, setEntries] = useState(() => {
    try {
      const data = JSON.parse(localStorage.getItem(entriesKey) || 'null');
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const sync = () => {
      try {
        const data = JSON.parse(localStorage.getItem(entriesKey) || 'null');
        setEntries(Array.isArray(data) ? data : []);
      } catch {
        setEntries([]);
      }
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [entriesKey]);

  // If in demo guest mode (!user) and no local entries, show guest demo preview
  const isDemoPreview = !user && entries.length === 0;

  const rangeEntries = useMemo(() => {
    return entries.filter((entry) => isEntryInRange(entry, activeRange));
  }, [entries, activeRange]);

  const todayEntries = useMemo(() => {
    return entries.filter((entry) => isEntryInRange(entry, 'today'));
  }, [entries]);

  const rangeSeconds = useMemo(() => {
    return rangeEntries.reduce((sum, e) => sum + (e.durationSeconds || 0), 0);
  }, [rangeEntries]);

  const todaySeconds = useMemo(() => {
    return todayEntries.reduce((sum, e) => sum + (e.durationSeconds || 0), 0);
  }, [todayEntries]);

  const streakDays = useMemo(() => calculateStreak(entries), [entries]);

  const dailyGoalSeconds = 4 * 3600; // 4 hours
  const goalAchievedPercent = Math.min(100, Math.round((todaySeconds / dailyGoalSeconds) * 100));

  const bestWindow = useMemo(() => getBestProductivityWindow(entries), [entries]);

  // Aggregate subjects for active range
  const computedSubjects = useMemo(() => {
    if (isDemoPreview) return demoSubjects;
    if (rangeEntries.length === 0) return [];

    const grouped = new Map();
    rangeEntries.forEach((entry) => {
      const key = `${entry.projectName}${entry.subjectName ? ` · ${entry.subjectName}` : ''}`;
      const current = grouped.get(key) || {
        name: key,
        seconds: 0,
        color: entry.color || '#f97316',
      };
      current.seconds += (entry.durationSeconds || 0);
      grouped.set(key, current);
    });

    const list = Array.from(grouped.values()).sort((a, b) => b.seconds - a.seconds);
    const maxSecs = list[0]?.seconds || 1;

    return list.map((item) => ({
      name: item.name,
      duration: formatDuration(item.seconds),
      width: `${Math.max(12, Math.round((item.seconds / maxSecs) * 100))}%`,
      color: item.color,
    }));
  }, [isDemoPreview, rangeEntries]);

  const rangeLabel = {
    today: 'Total Tracked Today',
    week: 'Total Tracked This Week',
    month: 'Total Tracked This Month',
    all: 'Total Tracked All Time',
  }[activeRange] || 'Total Tracked Today';

  const metrics = isDemoPreview
    ? demoMetrics
    : [
        {
          icon: Clock,
          tone: 'orange',
          value: formatDuration(rangeSeconds),
          label: rangeLabel,
        },
        {
          icon: Flame,
          tone: 'fire',
          value: `${streakDays} ${streakDays === 1 ? 'Day' : 'Days'}`,
          label: 'Personal Streak',
        },
        {
          icon: CheckCircle2,
          tone: 'green',
          value: rangeEntries.length === 0 ? '--' : `${Math.min(100, Math.round((rangeSeconds / Math.max(1, dailyGoalSeconds)) * 100))}%`,
          label: 'Focus Ratio',
        },
        {
          icon: Target,
          tone: 'purple',
          value: '4h 00m',
          label: 'Daily Goal Target',
        },
      ];

  return (
    <div className="dashboard-module-container">
      {/* Overview Banner Card */}
      <section className="metrics-summary-card" aria-label="Personal productivity dashboard">
        <div className="dashboard-header-banner">
          <div className="dashboard-heading-group">
            <BarChart3 className="dashboard-section-icon" size={24} />
            <div>
              <h2>Personal Dashboard</h2>
              <span className="date-badge">
                {isDemoPreview
                  ? 'Sample preview data · Sign in to record real study history'
                  : 'Tracked progress, streaks, and personal time distribution'}
              </span>
            </div>
          </div>

          <div className="date-range-pills" role="tablist" aria-label="Timeframe selection">
            {['today', 'week', 'month', 'all'].map((range) => (
              <button
                key={range}
                type="button"
                className={`date-range-btn ${activeRange === range ? 'active' : ''}`}
                onClick={() => setActiveRange(range)}
              >
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Top Metric Tiles */}
        <div className="metric-tiles-row">
          {metrics.map(({ icon: Icon, tone, value, label }) => (
            <div className="metric-tile" key={label}>
              <div className={`tile-icon-wrapper ${tone}`}><Icon size={20} /></div>
              <div className="tile-content">
                <span className="tile-value">{value}</span>
                <span className="tile-title">{label}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Analytics Grid */}
      <div className="dashboard-analytics-grid">
        {/* Subject & Project Distribution */}
        <div className="analytics-card">
          <div className="analytics-card-header">
            <h3>Subject & Project Distribution</h3>
            <span className="date-badge">By duration</span>
          </div>

          {computedSubjects.length === 0 ? (
            <div className="dashboard-empty-state">
              <div className="empty-icon-wrapper">
                <FolderKanban size={26} />
              </div>
              <h4>No study activity recorded yet</h4>
              <p>Start tracking your study sessions in the Timer to see your breakdown and focus trends.</p>
              <button
                type="button"
                className="dashboard-action-btn"
                onClick={() => onNavigate?.('timer')}
              >
                Go to Timer
              </button>
            </div>
          ) : (
            <div className="breakdown-bars">
              {computedSubjects.map(({ name, duration, width, color }) => (
                <div className="breakdown-item" key={name}>
                  <div className="item-label-row">
                    <span>{name}</span>
                    <span className="duration">{duration}</span>
                  </div>
                  <div className="progress-bg">
                    <div className="progress-fill" style={{ width, backgroundColor: color }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Goal Pace & Consistency */}
        <div className="analytics-card">
          <div className="analytics-card-header">
            <h3>Daily Study Goal</h3>
            <span className="date-badge">
              {isDemoPreview ? '135% achieved' : `${goalAchievedPercent}% achieved`}
            </span>
          </div>

          <div className="goal-progress-box">
            <div className="goal-status-row">
              <strong>
                {isDemoPreview ? '5h 24m / 4h 00m Goal' : `${formatDuration(todaySeconds)} / 4h 00m Goal`}
              </strong>
              <span>
                {isDemoPreview
                  ? 'Target Reached 🎉'
                  : todaySeconds >= dailyGoalSeconds
                  ? 'Target Reached 🎉'
                  : todaySeconds > 0
                  ? `${formatDuration(dailyGoalSeconds - todaySeconds)} remaining`
                  : 'No sessions yet today'}
              </span>
            </div>
            <div className="progress-bg">
              <div
                className="progress-fill"
                style={{
                  width: `${isDemoPreview ? 100 : goalAchievedPercent}%`,
                  backgroundColor: (isDemoPreview || goalAchievedPercent >= 100) ? '#10b981' : 'var(--sd-orange)',
                }}
              />
            </div>
            {!isDemoPreview && todaySeconds === 0 && (
              <p className="goal-empty-hint">Track study sessions today to build towards your 4-hour daily goal.</p>
            )}
          </div>

          <div className="goal-progress-box" style={{ marginTop: 'auto' }}>
            <div className="goal-status-row">
              <strong>
                <TrendingUp size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Best Productivity Window
              </strong>
              <span style={{ color: (isDemoPreview || bestWindow) ? 'var(--sd-text-primary)' : 'var(--sd-text-muted)' }}>
                {isDemoPreview ? '2:00 PM – 5:30 PM' : (bestWindow || 'No sessions recorded today')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
