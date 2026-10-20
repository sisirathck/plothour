import React, { useState, useEffect, useMemo } from 'react';
import {
  Sun,
  Moon,
  Settings,
  LogOut,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import './Dashboard.css';

// Dedicated dashboard artwork assets (8 pictures each for light and dark modes)
// Easily add more picture paths to these arrays as needed!
export const LIGHT_HERO_ARTS = [
  '/dashboard_whitetheme_1.png',
  '/dashboard_whitetheme_2.png',
  '/dashboard_whitetheme_3.png',
  '/dashboard_whitetheme_4.png',
  '/dashboard_whitetheme_5.png',
  '/dashboard_whitetheme_6.png',
  '/dashboard_whitetheme_7.png',
  '/dashboard_whitetheme_8.png',
];

export const DARK_HERO_ARTS = [
  '/dashboard_darktheme_1.png',
  '/dashboard_darktheme_2.png',
  '/dashboard_darktheme_3.png',
  '/dashboard_darktheme_4.png',
  '/dashboard_darktheme_5.png',
  '/dashboard_darktheme_6.png',
  '/dashboard_darktheme_7.png',
  '/dashboard_darktheme_8.png',
];

const pickNextHeroIndex = (currentIdx, totalCount) => {
  if (totalCount <= 1) return 0;
  let nextIdx;
  do {
    nextIdx = Math.floor(Math.random() * totalCount);
  } while (nextIdx === currentIdx);
  return nextIdx;
};

/* ── Helpers ─────────────────────────────────── */
const fmtDur = (s) => {
  if (!s || s <= 0) return '0m';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
};

const formatHoursTick = (seconds) => {
  const hours = seconds / 3600;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`;
};

const getHourTicks = (seconds) => {
  const hours = seconds / 3600;
  const step = hours <= 3 ? 0.5 : hours <= 6 ? 1 : Math.ceil(hours / 5);
  const max = Math.max(step, Math.ceil(hours / step) * step);
  return Array.from({ length: Math.round(max / step) + 1 }, (_, index) => index * step);
};

const DailyHoursGraph = ({ days, title }) => {
  const width = 900;
  const height = 240;
  const margin = { top: 14, right: 18, bottom: 34, left: 44 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const maxSeconds = Math.max(1800, ...days.map((day) => day.seconds));
  const hourTicks = getHourTicks(maxSeconds);
  const maxHours = hourTicks[hourTicks.length - 1];
  const slotWidth = plotWidth / days.length;
  const barWidth = Math.max(3, slotWidth * 0.64);

  return (
    <div className="db-chart-card db-card">
      <div className="db-chart-heading">
        <h3 className="db-section-title">Daily Hours</h3>
        <span className="db-section-meta">{title}</span>
      </div>
      <div className="db-chart-scroll">
        <svg className="db-svg-chart db-daily-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Daily study hours for ${title}`}>
          {hourTicks.map((value) => {
            const y = margin.top + plotHeight - (value / maxHours) * plotHeight;
            return (
              <g key={value}>
                <line className="db-chart-grid-line" x1={margin.left} x2={width - margin.right} y1={y} y2={y} />
                <text className="db-chart-axis-label" x={margin.left - 8} y={y + 4} textAnchor="end">{formatHoursTick(value * 3600)}</text>
              </g>
            );
          })}
          {days.map((day, index) => {
            const barHeight = (day.seconds / (maxHours * 3600)) * plotHeight;
            const x = margin.left + index * slotWidth + (slotWidth - barWidth) / 2;
            const y = margin.top + plotHeight - barHeight;
            return (
              <g key={day.key}>
                <rect className="db-chart-bar" x={x} y={y} width={barWidth} height={Math.max(day.seconds ? 2 : 0, barHeight)} rx="4">
                  <title>{`${day.dateLabel} · ${day.seconds ? fmtDur(day.seconds) : 'No study logged'}`}</title>
                </rect>
                {(index === 0 || index % 4 === 0 || index === days.length - 1) && (
                  <text className="db-chart-axis-label" x={x + barWidth / 2} y={height - 10} textAnchor="middle">{day.dayOfMonth}</text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

const WeeklyTrendGraph = ({ weeks }) => {
  const width = 900;
  const height = 300;
  const margin = { top: 20, right: 22, bottom: 42, left: 48 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const maxSeconds = Math.max(1800, ...weeks.flatMap((week) => [week.seconds, week.averageSeconds]));
  const hourTicks = getHourTicks(maxSeconds);
  const maxHours = hourTicks[hourTicks.length - 1];
  const xFor = (index) => margin.left + (index / Math.max(1, weeks.length - 1)) * plotWidth;
  const yFor = (seconds) => margin.top + plotHeight - (seconds / (maxHours * 3600)) * plotHeight;
  const linePoints = weeks.map((week, index) => `${xFor(index)},${yFor(week.averageSeconds)}`).join(' ');

  return (
    <div className="db-chart-card db-card">
      <div className="db-chart-heading db-chart-heading-stack">
        <div>
          <h3 className="db-section-title">Weekly Study Trend</h3>
          <span className="db-section-meta">Last 12 weeks · 4-week moving average</span>
        </div>
        <div className="db-chart-legend" aria-label="Chart legend">
          <span><i className="db-legend-bar" /> Study hours</span>
          <span><i className="db-legend-line" /> 4-week average</span>
        </div>
      </div>
      <div className="db-chart-scroll">
        <svg className="db-svg-chart db-trend-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Weekly study hours and four-week moving average">
          {hourTicks.map((value) => {
            const y = margin.top + plotHeight - (value / maxHours) * plotHeight;
            return (
              <g key={value}>
                <line className="db-chart-grid-line" x1={margin.left} x2={width - margin.right} y1={y} y2={y} />
                <text className="db-chart-axis-label" x={margin.left - 8} y={y + 4} textAnchor="end">{formatHoursTick(value * 3600)}</text>
              </g>
            );
          })}
          {weeks.map((week, index) => {
            const slot = plotWidth / weeks.length;
            const barWidth = slot * 0.5;
            const barHeight = (week.seconds / (maxHours * 3600)) * plotHeight;
            const x = xFor(index) - barWidth / 2;
            const y = margin.top + plotHeight - barHeight;
            return (
              <g key={week.key}>
                <rect className="db-chart-bar db-chart-bar-muted" x={x} y={y} width={barWidth} height={Math.max(week.seconds ? 2 : 0, barHeight)} rx="4">
                  <title>{`Week of ${week.startLabel} · ${fmtDur(week.seconds)}`}</title>
                </rect>
                {index % 2 === 0 && (
                  <text className="db-chart-axis-label" x={xFor(index)} y={height - 12} textAnchor="middle">{week.axisLabel}</text>
                )}
                <circle className="db-chart-line-point" cx={xFor(index)} cy={yFor(week.averageSeconds)} r="3.2">
                  <title>{`4-week average through ${week.startLabel} · ${fmtDur(week.averageSeconds)}`}</title>
                </circle>
              </g>
            );
          })}
          <polyline className="db-chart-average-line" points={linePoints} />
        </svg>
      </div>
    </div>
  );
};

const SessionLengthGraph = ({ buckets }) => {
  const width = 720;
  const height = 300;
  const margin = { top: 22, right: 18, bottom: 44, left: 42 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const maxCount = Math.max(1, ...buckets.map((bucket) => bucket.count));
  const tickStep = Math.max(1, Math.ceil(maxCount / 4));
  const maxY = tickStep * 4;
  const slotWidth = plotWidth / buckets.length;
  const barWidth = slotWidth * 0.56;

  return (
    <div className="db-chart-card db-card">
      <div className="db-chart-heading db-chart-heading-stack">
        <div>
          <h3 className="db-section-title">Session Length</h3>
          <span className="db-section-meta">Distribution across tracked sessions</span>
        </div>
      </div>
      <div className="db-chart-scroll">
        <svg className="db-svg-chart db-session-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Number of sessions by session length">
          {Array.from({ length: 5 }, (_, index) => {
            const value = (maxY * index) / 4;
            const y = margin.top + plotHeight - (value / maxY) * plotHeight;
            return (
              <g key={index}>
                <line className="db-chart-grid-line" x1={margin.left} x2={width - margin.right} y1={y} y2={y} />
                <text className="db-chart-axis-label" x={margin.left - 8} y={y + 4} textAnchor="end">{Math.round(value)}</text>
              </g>
            );
          })}
          {buckets.map((bucket, index) => {
            const barHeight = (bucket.count / maxY) * plotHeight;
            const x = margin.left + index * slotWidth + (slotWidth - barWidth) / 2;
            const y = margin.top + plotHeight - barHeight;
            return (
              <g key={bucket.label}>
                <rect className="db-chart-bar" x={x} y={y} width={barWidth} height={Math.max(bucket.count ? 2 : 0, barHeight)} rx="4">
                  <title>{`${bucket.label}: ${bucket.count} ${bucket.count === 1 ? 'session' : 'sessions'}`}</title>
                </rect>
                {bucket.count > 0 && <text className="db-chart-value-label" x={x + barWidth / 2} y={Math.max(margin.top + 12, y - 7)} textAnchor="middle">{bucket.count}</text>}
                <text className="db-chart-axis-label" x={x + barWidth / 2} y={height - 12} textAnchor="middle">{bucket.label}</text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};


const dateKey = (d) => {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

const isInRange = (entry, range) => {
  if (!entry?.startedAt) return false;
  const d = new Date(entry.startedAt);
  const now = new Date();
  if (range === 'Today' || range === 'today') {
    return d.toDateString() === now.toDateString();
  }
  if (range === 'Week' || range === 'week') {
    const s = new Date(now);
    s.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    s.setHours(0, 0, 0, 0);
    return d >= s;
  }
  if (range === 'Month' || range === 'month') {
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }
  return true; // 'All time' or 'all'
};

const calcStreak = (entries) => {
  const dates = new Set();
  entries.forEach((e) => {
    if (e.durationSeconds > 0 && e.startedAt) {
      dates.add(dateKey(e.startedAt));
    }
  });
  if (!dates.size) return 0;
  const now = new Date();
  const todayK = dateKey(now);
  const yest = new Date(now);
  yest.setDate(yest.getDate() - 1);
  const yesterK = dateKey(yest);
  let check = dates.has(todayK) ? new Date(now) : dates.has(yesterK) ? yest : null;
  if (!check) return 0;
  let n = 0;
  while (true) {
    if (dates.has(dateKey(check))) {
      n++;
      check.setDate(check.getDate() - 1);
    } else {
      break;
    }
  }
  return n;
};

export function DashboardPage({ user, onNavigate, standalone = false }) {
  const { theme: currentTheme, toggleTheme } = useTheme();
  const isDark = currentTheme === 'dark';

  const [activeNav, setActiveNav] = useState('Dashboard');
  const [portfolioRange, setPortfolioRange] = useState('Today');

  // Project goals are managed in /manage and stored with the project hierarchy.
  const projectsKey = user?.id ? `studyduel_user_${user.id}_projects` : 'studyduel_demo_projects';
  const [projects, setProjects] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(projectsKey) || '[]');
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    const syncProjects = () => {
      try {
        const saved = JSON.parse(localStorage.getItem(projectsKey) || '[]');
        setProjects(Array.isArray(saved) ? saved : []);
      } catch {
        setProjects([]);
      }
    };
    window.addEventListener('storage', syncProjects);
    return () => window.removeEventListener('storage', syncProjects);
  }, [projectsKey]);

  const dailyGoalHours = useMemo(() => projects.reduce(
    (total, project) => total + (project.archived ? 0 : (project.subjects || []).reduce(
      (subjectTotal, subject) => subjectTotal + (Number(subject.goals?.daily) || 0), 0
    )), 0
  ), [projects]);

  // Pick a different piece of artwork on each page load.
  const [heroArtIndex, setHeroArtIndex] = useState(() => {
    const totalCount = Math.min(LIGHT_HERO_ARTS.length, DARK_HERO_ARTS.length);
    const saved = parseInt(localStorage.getItem('studyduel_hero_art_index') || '-1', 10);
    const previousIndex = Number.isInteger(saved) && saved >= 0 && saved < totalCount ? saved : -1;
    return pickNextHeroIndex(previousIndex, totalCount);
  });

  // Preload all hero artwork for instantaneous, flicker-free switching.
  useEffect(() => {
    [...LIGHT_HERO_ARTS, ...DARK_HERO_ARTS].forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  // Remember the current image so the next browser refresh picks a different one.
  useEffect(() => {
    localStorage.setItem('studyduel_hero_art_index', String(heroArtIndex));
  }, [heroArtIndex]);

  // Rotate artwork on a steady 10-minute interval while the dashboard is open.
  useEffect(() => {
    const totalCount = Math.min(LIGHT_HERO_ARTS.length, DARK_HERO_ARTS.length);
    if (totalCount <= 1) return undefined;

    const timer = window.setInterval(() => {
      setHeroArtIndex((currentIndex) => pickNextHeroIndex(currentIndex, totalCount));
    }, 10 * 60 * 1000);

    return () => window.clearInterval(timer);
  }, []);

  const currentHeroArt = isDark
    ? (DARK_HERO_ARTS[heroArtIndex] || DARK_HERO_ARTS[0])
    : (LIGHT_HERO_ARTS[heroArtIndex] || LIGHT_HERO_ARTS[0]);

  // Storage key for user session entries
  const entriesKey = user?.id ? `studyduel_user_${user.id}_time_entries` : 'studyduel_demo_time_entries';

  const [entries, setEntries] = useState(() => {
    try {
      const d = JSON.parse(localStorage.getItem(entriesKey) || 'null');
      return Array.isArray(d) ? d : [];
    } catch {
      return [];
    }
  });

  // Sync entries from storage
  useEffect(() => {
    const sync = () => {
      try {
        const d = JSON.parse(localStorage.getItem(entriesKey) || 'null');
        setEntries(Array.isArray(d) ? d : []);
      } catch {
        setEntries([]);
      }
    };
    window.addEventListener('storage', sync);
    window.addEventListener('studyduel:timer-storage', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('studyduel:timer-storage', sync);
    };
  }, [entriesKey]);

  /* ── Core Computed Metrics ───────────────────── */
  const todayEntries = useMemo(() => entries.filter((e) => isInRange(e, 'Today')), [entries]);
  const weekEntries = useMemo(() => entries.filter((e) => isInRange(e, 'Week')), [entries]);
  const monthEntries = useMemo(() => entries.filter((e) => isInRange(e, 'Month')), [entries]);

  const todaySecs = useMemo(
    () => todayEntries.reduce((s, e) => s + (e.durationSeconds || 0), 0),
    [todayEntries]
  );
  const weekSecs = useMemo(
    () => weekEntries.reduce((s, e) => s + (e.durationSeconds || 0), 0),
    [weekEntries]
  );
  const monthSecs = useMemo(
    () => monthEntries.reduce((s, e) => s + (e.durationSeconds || 0), 0),
    [monthEntries]
  );
  const allSecs = useMemo(
    () => entries.reduce((s, e) => s + (e.durationSeconds || 0), 0),
    [entries]
  );

  // Daily goal calculation
  const goalSecs = dailyGoalHours * 3600;
  const goalPct = goalSecs > 0 ? Math.min(100, Math.round((todaySecs / goalSecs) * 100)) : 0;
  const goalRemainingSecs = Math.max(0, goalSecs - todaySecs);

  // SVG Progress Ring circumference: 2 * PI * 40 = 251.327
  const ringCircumference = 251.327;
  const strokeDashoffset = goalSecs > 0
    ? ringCircumference * (1 - Math.min(1, todaySecs / goalSecs))
    : ringCircumference;

  // Yesterday's volume for comparison
  const yestSecs = useMemo(() => {
    const yest = new Date();
    yest.setDate(yest.getDate() - 1);
    const yK = dateKey(yest);
    return entries
      .filter((e) => e.startedAt && dateKey(e.startedAt) === yK)
      .reduce((s, e) => s + (e.durationSeconds || 0), 0);
  }, [entries]);

  // Prior week volume for WoW Velocity
  const priorWeekSecs = useMemo(() => {
    const now = new Date();
    const day = (now.getDay() + 6) % 7;
    const thisStart = new Date(now);
    thisStart.setDate(now.getDate() - day);
    thisStart.setHours(0, 0, 0, 0);

    const prevStart = new Date(thisStart);
    prevStart.setDate(prevStart.getDate() - 7);
    const prevEnd = new Date(thisStart);
    prevEnd.setDate(prevEnd.getDate() - 1);
    prevEnd.setHours(23, 59, 59, 999);

    return entries
      .filter((e) => {
        if (!e.startedAt) return false;
        const d = new Date(e.startedAt);
        return d >= prevStart && d <= prevEnd;
      })
      .reduce((s, e) => s + (e.durationSeconds || 0), 0);
  }, [entries]);

  const weekVelocityPct = useMemo(() => {
    if (priorWeekSecs === 0) return weekSecs > 0 ? 100 : 0;
    return Math.round(((weekSecs - priorWeekSecs) / priorWeekSecs) * 100);
  }, [weekSecs, priorWeekSecs]);

  // Streak & 14-day consistency
  const streak = useMemo(() => calcStreak(entries), [entries]);
  const consistency14 = useMemo(() => {
    const dates = new Set();
    entries.forEach((e) => {
      if (e.durationSeconds > 0 && e.startedAt) dates.add(dateKey(e.startedAt));
    });
    const now = new Date();
    let activeDays = 0;
    for (let i = 0; i < 14; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      if (dates.has(dateKey(d))) activeDays++;
    }
    return Math.round((activeDays / 14) * 100);
  }, [entries]);

  // Daily avg this week
  const dailyAvg = useMemo(() => {
    if (!weekEntries.length) return 0;
    const activeDays = new Set(weekEntries.map((e) => dateKey(e.startedAt)));
    return Math.round(weekSecs / Math.max(1, activeDays.size));
  }, [weekEntries, weekSecs]);

  /* ── ROW 2: Focus Depth & Flow State Tiers ──── */
  const sessionTierStats = useMemo(() => {
    let sprint = 0,
      pomodoro = 0,
      deepFlow = 0,
      marathon = 0;
    entries.forEach((e) => {
      const dur = e.durationSeconds || 0;
      if (dur < 20 * 60) sprint++;
      else if (dur < 45 * 60) pomodoro++;
      else if (dur < 90 * 60) deepFlow++;
      else marathon++;
    });
    const total = entries.length;
    const flowCount = deepFlow + marathon;
    const flowRatio = total > 0 ? Math.round((flowCount / total) * 100) : 0;

    return {
      sprint,
      pomodoro,
      deepFlow,
      marathon,
      total,
      flowRatio,
      sprintPct: total > 0 ? Math.round((sprint / total) * 100) : 0,
      pomodoroPct: total > 0 ? Math.round((pomodoro / total) * 100) : 0,
      deepFlowPct: total > 0 ? Math.round((deepFlow / total) * 100) : 0,
      marathonPct: total > 0 ? Math.round((marathon / total) * 100) : 0,
    };
  }, [entries]);

  // Avg focus depth & longest session
  const avgFocusDepth = useMemo(() => {
    if (!entries.length) return 0;
    return Math.round(allSecs / entries.length);
  }, [entries, allSecs]);

  const longestSession = useMemo(() => {
    if (!entries.length) return 0;
    return Math.max(...entries.map((e) => e.durationSeconds || 0));
  }, [entries]);

  // Context switching rate (subjects per active day)
  const contextSwitching = useMemo(() => {
    if (!entries.length) return '1.0 subj/day';
    const dayMap = {};
    entries.forEach((e) => {
      const k = dateKey(e.startedAt);
      if (!dayMap[k]) dayMap[k] = new Set();
      dayMap[k].add(e.subjectName || e.projectName || 'General');
    });
    const days = Object.keys(dayMap);
    if (!days.length) return '1.0 subj/day';
    const totalSubjects = days.reduce((sum, d) => sum + dayMap[d].size, 0);
    return `${(totalSubjects / days.length).toFixed(1)} subj/day`;
  }, [entries]);

  // Peak cognitive hour
  const peakHourLabel = useMemo(() => {
    if (!entries.length) return '—';
    const hourVolumes = Array(24).fill(0);
    entries.forEach((e) => {
      if (!e.startedAt) return;
      const h = new Date(e.startedAt).getHours();
      hourVolumes[h] += e.durationSeconds || 0;
    });
    let bestH = 0,
      maxV = -1;
    hourVolumes.forEach((v, h) => {
      if (v > maxV) {
        maxV = v;
        bestH = h;
      }
    });
    if (maxV <= 0) return '—';
    const period = bestH >= 12 ? 'PM' : 'AM';
    const displayH = bestH % 12 === 0 ? 12 : bestH % 12;
    return `${displayH}:00 ${period}`;
  }, [entries]);

  /* ── ROW 3: Circadian Focus Window ──────────── */
  const circadianStats = useMemo(() => {
    let m = 0,
      a = 0,
      e = 0,
      n = 0;
    entries.forEach((entry) => {
      if (!entry.startedAt) return;
      const h = new Date(entry.startedAt).getHours();
      const dur = entry.durationSeconds || 0;
      if (h >= 5 && h < 12) m += dur;
      else if (h >= 12 && h < 17) a += dur;
      else if (h >= 17 && h < 22) e += dur;
      else n += dur;
    });
    const total = m + a + e + n;
    const slots = [
      { title: 'Morning', sub: '5A–12P', secs: m },
      { title: 'Afternoon', sub: '12P–5P', secs: a },
      { title: 'Evening', sub: '5P–10P', secs: e },
      { title: 'Night', sub: '10P–5A', secs: n },
    ];
    let bestSlot = slots[0];
    slots.forEach((s) => {
      if (s.secs > bestSlot.secs) bestSlot = s;
    });

    return {
      slots: slots.map((s) => ({
        ...s,
        val: s.secs > 0 ? fmtDur(s.secs) : '—',
        pctNum: total > 0 ? Math.round((s.secs / total) * 100) : 0,
        pct: total > 0 ? `${Math.round((s.secs / total) * 100)}% of study` : '0% of study',
        active: s.secs > 0 && s.title === bestSlot.title,
      })),
      bestSlotTitle: bestSlot.secs > 0 ? `${bestSlot.title} (${bestSlot.sub})` : 'Morning (5A–12P)',
      bestPct: total > 0 ? Math.round((bestSlot.secs / total) * 100) : 0,
      hasData: total > 0,
    };
  }, [entries]);

  /* ── ROW 3: Day-of-Week Power Rhythm ────────── */
  const dayOfWeekStats = useMemo(() => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayTotals = [0, 0, 0, 0, 0, 0, 0];
    entries.forEach((entry) => {
      if (!entry.startedAt) return;
      const dayIdx = new Date(entry.startedAt).getDay();
      dayTotals[dayIdx] += entry.durationSeconds || 0;
    });
    const maxDaySecs = Math.max(1, ...dayTotals);
    let bestIdx = 1;
    dayTotals.forEach((secs, idx) => {
      if (secs > dayTotals[bestIdx]) bestIdx = idx;
    });

    return {
      rows: dayNames.map((name, idx) => {
        const secs = dayTotals[idx];
        const pct = Math.max(2, Math.round((secs / maxDaySecs) * 100));
        const active = secs > 0 && idx === bestIdx;
        return {
          day: name,
          val: secs > 0 ? fmtDur(secs) : '—',
          pct,
          active,
          secs,
        };
      }),
      powerDayName: dayTotals[bestIdx] > 0 ? dayNames[bestIdx] : 'Mon',
      powerDayVolume: fmtDur(dayTotals[bestIdx]),
      hasData: dayTotals.some((s) => s > 0),
    };
  }, [entries]);

  /* ── ROW 4: Weekly Study (Last 7 Days) ──────── */
  const weekBarData = useMemo(() => {
    const map = new Map();
    entries.forEach((e) => {
      if (!e.startedAt) return;
      const k = dateKey(e.startedAt);
      map.set(k, (map.get(k) || 0) + (e.durationSeconds || 0));
    });
    const now = new Date();
    const days = [];
    const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const k = dateKey(d);
      const val = map.get(k) || 0;
      days.push({
        day: labels[d.getDay()],
        val,
        label: val > 0 ? fmtDur(val) : '',
        active: i === 0, // Today
        isToday: i === 0,
      });
    }
    const maxVal = Math.max(1, ...days.map((d) => d.val));
    const totalWeeklySecs = days.reduce((sum, d) => sum + d.val, 0);
    let peakCol = days[0];
    days.forEach((d) => {
      if (d.val > peakCol.val) peakCol = d;
    });

    return {
      cols: days.map((d) => ({
        ...d,
        h: d.val > 0 ? Math.max(6, Math.round((d.val / maxVal) * 100)) : 0,
        muted: d.val > 0 && !d.isToday,
      })),
      totalWeeklySecs,
      totalWeeklyFmt: fmtDur(totalWeeklySecs),
      peakDayLabel: peakCol.val > 0 ? peakCol.day : '—',
      peakDayFmt: peakCol.val > 0 ? fmtDur(peakCol.val) : '0m',
    };
  }, [entries]);

  const dailyHoursData = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const dayCount = new Date(year, month + 1, 0).getDate();
    const totals = new Map();
    entries.forEach((entry) => {
      if (!entry.startedAt) return;
      const key = dateKey(entry.startedAt);
      totals.set(key, (totals.get(key) || 0) + (entry.durationSeconds || 0));
    });
    const days = Array.from({ length: dayCount }, (_, index) => {
      const date = new Date(year, month, index + 1);
      const key = dateKey(date);
      return {
        key,
        dayOfMonth: date.getDate(),
        dateLabel: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        seconds: totals.get(key) || 0,
      };
    });
    return {
      days,
      title: `${dateKey(new Date(year, month, 1))} → ${dateKey(new Date(year, month, dayCount))}`,
    };
  }, [entries]);

  const weeklyTrendData = useMemo(() => {
    const now = new Date();
    const currentSunday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    currentSunday.setHours(0, 0, 0, 0);
    const totals = new Map();
    entries.forEach((entry) => {
      if (!entry.startedAt) return;
      const date = new Date(entry.startedAt);
      date.setDate(date.getDate() - date.getDay());
      date.setHours(0, 0, 0, 0);
      const key = dateKey(date);
      totals.set(key, (totals.get(key) || 0) + (entry.durationSeconds || 0));
    });
    const weeks = Array.from({ length: 12 }, (_, index) => {
      const start = new Date(currentSunday);
      start.setDate(start.getDate() - (11 - index) * 7);
      const key = dateKey(start);
      const seconds = totals.get(key) || 0;
      const windowStart = Math.max(0, index - 3);
      const recent = Array.from({ length: index - windowStart + 1 }, (_, offset) => {
        const prev = new Date(start);
        prev.setDate(prev.getDate() - (index - (windowStart + offset)) * 7);
        return totals.get(dateKey(prev)) || 0;
      });
      return {
        key,
        seconds,
        averageSeconds: recent.reduce((sum, value) => sum + value, 0) / recent.length,
        startLabel: start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        axisLabel: start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      };
    });
    return weeks;
  }, [entries]);

  const sessionLengthData = useMemo(() => {
    const buckets = [
      { label: 'Under 15m', count: 0 },
      { label: '15–45m', count: 0 },
      { label: '45–90m', count: 0 },
      { label: '90m+', count: 0 },
    ];
    entries.forEach((entry) => {
      const duration = entry.durationSeconds || 0;
      if (duration < 15 * 60) buckets[0].count += 1;
      else if (duration < 45 * 60) buckets[1].count += 1;
      else if (duration < 90 * 60) buckets[2].count += 1;
      else buckets[3].count += 1;
    });
    return buckets;
  }, [entries]);

  /* ── ROW 4: Project Portfolio Breakdown ─────── */
  const portfolioEntries = useMemo(
    () => entries.filter((e) => isInRange(e, portfolioRange)),
    [entries, portfolioRange]
  );

  const portfolioStats = useMemo(() => {
    const map = new Map();
    portfolioEntries.forEach((e) => {
      const proj = e.projectName || 'General Study';
      const sub = e.subjectName || '';
      const key = `${proj}:::${sub}`;
      if (!map.has(key)) {
        map.set(key, {
          projectName: proj,
          subjectName: sub,
          color: e.color || '#f3957f',
          count: 0,
          secs: 0,
        });
      }
      const item = map.get(key);
      item.count += 1;
      item.secs += e.durationSeconds || 0;
    });

    const list = Array.from(map.values()).sort((a, b) => b.secs - a.secs);
    const rangeTotalSecs = list.reduce((sum, item) => sum + item.secs, 0);
    const topPct =
      list.length > 0 && rangeTotalSecs > 0
        ? Math.round((list[0].secs / rangeTotalSecs) * 100)
        : 100;

    return {
      list: list.map((item) => ({
        ...item,
        pct: rangeTotalSecs > 0 ? Math.max(4, Math.round((item.secs / rangeTotalSecs) * 100)) : 0,
        durationFmt: fmtDur(item.secs),
      })),
      totalProjects: list.length,
      topPct,
    };
  }, [portfolioEntries]);

  /* ── ROW 5: 24h × 7d Time-of-Day Heatmap ────── */
  const heatmapStats = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const matrix = Array.from({ length: 7 }, () => Array(24).fill(0));
    entries.forEach((e) => {
      if (!e.startedAt) return;
      const d = new Date(e.startedAt);
      const dayIdx = d.getDay();
      const hour = d.getHours();
      matrix[dayIdx][hour] += e.durationSeconds || 0;
    });

    let maxCell = 1;
    let peakDayIdx = 2; // Tue default
    let peakHour = 0;
    for (let day = 0; day < 7; day++) {
      for (let hr = 0; hr < 24; hr++) {
        if (matrix[day][hr] > maxCell) {
          maxCell = matrix[day][hr];
          peakDayIdx = day;
          peakHour = hr;
        }
      }
    }

    return {
      days,
      matrix,
      maxCell,
      peakDayIdx,
      peakHour,
    };
  }, [entries]);

  /* ── ROW 6: 52-Week Activity Calendar ───────── */
  const activityCalStats = useMemo(() => {
    const dateMap = new Map();
    entries.forEach((e) => {
      if (!e.startedAt) return;
      const k = dateKey(e.startedAt);
      dateMap.set(k, (dateMap.get(k) || 0) + (e.durationSeconds || 0));
    });

    const now = new Date();
    // Align to Sunday 52 weeks ago
    const start = new Date(now);
    start.setDate(now.getDate() - 52 * 7);
    start.setDate(start.getDate() - start.getDay());
    start.setHours(0, 0, 0, 0);

    const weeks = [];
    let curWeek = [];
    const cur = new Date(start);

    let maxVal = 1;
    let activeDaysCount = 0;

    while (cur <= now) {
      const k = dateKey(cur);
      const val = dateMap.get(k) || 0;
      if (val > maxVal) maxVal = val;
      if (val > 0) activeDaysCount++;

      curWeek.push({
        key: k,
        dateStr: cur.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
        val,
        isToday: cur.toDateString() === now.toDateString(),
      });

      if (cur.getDay() === 6) {
        weeks.push(curWeek);
        curWeek = [];
      }
      cur.setDate(cur.getDate() + 1);
    }
    if (curWeek.length > 0) {
      while (curWeek.length < 7) curWeek.push(null);
      weeks.push(curWeek);
    }

    // Month headers
    const monthNames = [
      'Oct',
      'Nov',
      'Dec',
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
    ];

    return {
      weeks,
      monthNames,
      maxVal,
      activeDaysCount,
    };
  }, [entries]);

  // Determine dominant tier to highlight
  const dominantTier = useMemo(() => {
    const { sprint, pomodoro, deepFlow, marathon } = sessionTierStats;
    const maxVal = Math.max(sprint, pomodoro, deepFlow, marathon);
    if (maxVal === 0) return 'marathon';
    if (marathon === maxVal) return 'marathon';
    if (deepFlow === maxVal) return 'deepFlow';
    if (pomodoro === maxVal) return 'pomodoro';
    return 'sprint';
  }, [sessionTierStats]);

  return (
    <div className={`db-apple-root ${isDark ? 'dark-mode' : 'light-mode'}`}>
      {/* ================= OPTIONAL FLOATING NAVBAR (When standalone) ================= */}
      {standalone && (
        <header className="db-apple-navbar">
          <div className="db-navbar-inner">
            <div className="db-navbar-brand">
              <div className="db-brand-icon">⏳</div>
              <span className="db-brand-text">
                Study<span className="db-brand-accent">Duel</span>
              </span>
              <span className="db-brand-divider" />
              <span className="db-brand-user">{user ? user.display_name : 'Guest'}</span>
            </div>

            <nav className="db-segmented-nav">
              {['Timer', 'Dashboard', 'Compare', 'Manage'].map((tab) => {
                const active = activeNav === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => {
                      setActiveNav(tab);
                      onNavigate?.(tab.toLowerCase());
                    }}
                    className={`db-nav-pill ${active ? 'active' : ''}`}
                  >
                    {tab}
                  </button>
                );
              })}
            </nav>

            <div className="db-navbar-actions">
              <button
                onClick={toggleTheme}
                aria-label="Toggle theme"
                className="db-action-circle-btn"
                title="Toggle Theme"
              >
                {isDark ? (
                  <Sun className="w-4 h-4" style={{ color: 'var(--sd-coral-primary)' }} />
                ) : (
                  <Moon className="w-4 h-4 text-[#5C5C5F]" />
                )}
              </button>
              <button
                onClick={() => onNavigate?.('settings')}
                className="db-action-circle-btn"
                title="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button
                onClick={() => onNavigate?.('timer')}
                className="db-action-exit-btn"
                title="Exit Demo"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Exit demo</span>
              </button>
            </div>
          </div>
        </header>
      )}

      {/* ================= MAIN BENTO CONTAINER ================= */}
      <div className="db-bento-container">
        {/* ROW 1: PAINTERLY WINDOW HERO (LEFT) + 6 KPI BENTO GRID (RIGHT) */}
        <div className="db-bento-grid-row db-hero-row">
          {/* Painterly Illustrated Window + Glassmorphic Daily Goal */}
          <div className="db-hero-window-card">
            {/* Background Illustration with Smooth Cross-Fade */}
            <img
              key={`${isDark ? 'dark' : 'light'}-${heroArtIndex}`}
              src={currentHeroArt}
              alt="Cozy Focus Sanctuary"
              className="db-hero-art-img"
            />
            {/* Directional Gradient Scrim: Character & scenery shine on right */}
            <div className="db-hero-gradient-scrim" />

            {/* Frosted Glass Apple Activity Card */}
            <div className="db-hero-goal-glass-card">
              <div className="db-goal-card-header">
                <span className="db-goal-card-title">Daily Goal</span>
                <button
                  onClick={() => onNavigate?.('manage')}
                  className="db-goal-edit-btn"
                >
                  {dailyGoalHours > 0 ? 'Edit' : 'Set goals'}
                </button>
              </div>

                <div className="db-goal-content-flex">
                  {/* SVG Smooth Progress Ring */}
                  <div className="db-goal-ring-wrapper">
                    <svg className="db-goal-ring-svg" viewBox="0 0 100 100">
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="transparent"
                        className="db-goal-ring-bg-circle"
                        strokeWidth="9"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="transparent"
                        stroke="var(--sd-coral-primary)"
                        strokeWidth="9"
                        strokeDasharray={ringCircumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        className="db-goal-ring-fill-circle"
                      />
                    </svg>
                    <div className="db-goal-ring-center">
                      <span className="db-goal-pct-num">{goalPct}%</span>
                      <span className="db-goal-pct-sub">of goal</span>
                    </div>
                  </div>

                  {/* Goal Breakdown */}
                  <div className="db-goal-breakdown-list">
                    <div className="db-goal-breakdown-row">
                      <span className="db-goal-row-label">Today</span>
                      <span className="db-goal-row-val">{todaySecs > 0 ? fmtDur(todaySecs) : '—'}</span>
                    </div>
                    <div className="db-goal-breakdown-row">
                      <span className="db-goal-row-label">Goal</span>
                      <span className="db-goal-row-val">{dailyGoalHours}h</span>
                    </div>
                    <div className="db-goal-breakdown-row no-border">
                      <span className="db-goal-row-label">Remaining</span>
                      <span className="db-goal-row-val accent">
                        {goalSecs <= 0 ? '—' : todaySecs >= goalSecs ? 'Goal Met! 🎉' : fmtDur(goalRemainingSecs)}
                      </span>
                    </div>
                  </div>
                </div>
            </div>
          </div>

          {/* 6 KPI Stat Cards (Anchored with Tinted Squircle Badges & Tabular Typography) */}
          <div className="db-kpi-grid">
            {[
              {
                label: 'TODAY',
                value: todaySecs > 0 ? fmtDur(todaySecs) : '—',
                sub: `${fmtDur(yestSecs)} yesterday`,
              },
              {
                label: 'THIS WEEK',
                value: fmtDur(weekSecs),
                sub: 'vs prior week',
                badge: `${weekVelocityPct >= 0 ? `+${weekVelocityPct}%` : `${weekVelocityPct}%`}`,
              },
              {
                label: 'THIS MONTH',
                value: fmtDur(monthSecs),
                sub: `${monthEntries.length} ${monthEntries.length === 1 ? 'session' : 'sessions'} logged`,
              },
              {
                label: 'ALL TIME',
                value: fmtDur(allSecs),
                sub: `${entries.length} total ${entries.length === 1 ? 'session' : 'sessions'}`,
              },
              {
                label: 'CURRENT STREAK',
                value: `${streak} ${streak === 1 ? 'day' : 'days'}`,
                sub: `${consistency14}% 14-day consistency`,
              },
              {
                label: 'DAILY AVG',
                value: fmtDur(dailyAvg),
                sub: 'Active days · This week',
              },
            ].map((kpi, idx) => {
              return (
                <div key={idx} className="db-kpi-card">
                  <div className="db-kpi-header">
                    <span className="db-kpi-label">{kpi.label}</span>
                  </div>
                  <div className="db-kpi-val-container">
                    <div className="db-kpi-value">{kpi.value}</div>
                  </div>
                  <div className="db-kpi-sub-row">
                    {kpi.badge ? (
                      <>
                        <span className={`db-kpi-trend-pill ${weekVelocityPct >= 0 ? 'is-positive' : 'is-negative'}`}>{kpi.badge}</span>
                        <span className="db-kpi-sub">{kpi.sub}</span>
                      </>
                    ) : (
                      <span className="db-kpi-sub">{kpi.sub}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ROW 2: FOCUS DEPTH & FLOW STATE (FULL WIDTH) */}
        <div className="db-card db-flow-card">
          <div className="db-card-header-flex">
            <div className="db-card-title-group">
              <h2 className="db-section-title">Focus Depth & Flow State</h2>
            </div>
            <span className="db-section-meta">Cognitive Session Distribution</span>
          </div>

          {/* Harmonized Proportional Segmented Bar in Recessed Track */}
          <div className="db-segmented-bar-track">
            {sessionTierStats.total === 0 ? (
              <div className="db-segmented-empty" />
            ) : (
              <>
                {sessionTierStats.sprintPct > 0 && (
                  <div
                    className="db-segmented-slice slice-sprint"
                    style={{ width: `${sessionTierStats.sprintPct}%` }}
                    title={`Sprint (<20m): ${sessionTierStats.sprintPct}%`}
                  />
                )}
                {sessionTierStats.pomodoroPct > 0 && (
                  <div
                    className="db-segmented-slice slice-pomodoro"
                    style={{ width: `${sessionTierStats.pomodoroPct}%` }}
                    title={`Pomodoro (20–45m): ${sessionTierStats.pomodoroPct}%`}
                  />
                )}
                {sessionTierStats.deepFlowPct > 0 && (
                  <div
                    className="db-segmented-slice slice-deepflow"
                    style={{ width: `${sessionTierStats.deepFlowPct}%` }}
                    title={`Deep Flow (45–90m): ${sessionTierStats.deepFlowPct}%`}
                  />
                )}
                {sessionTierStats.marathonPct > 0 && (
                  <div
                    className="db-segmented-slice slice-marathon"
                    style={{ width: `${sessionTierStats.marathonPct}%` }}
                    title={`Marathon (>90m): ${sessionTierStats.marathonPct}%`}
                  />
                )}
              </>
            )}
          </div>

          {/* 4 Session Sub-Cards with Internal Mini Progress Bars */}
          <div className="db-tier-cards-grid">
            {[
              {
                id: 'sprint',
                name: 'Sprint (<20m)',
                sess: `${sessionTierStats.sprint} sess`,
                pct: `${sessionTierStats.sprintPct}%`,
                pctNum: sessionTierStats.sprintPct,
                dotClass: 'dot-sprint',
                active: dominantTier === 'sprint' && sessionTierStats.sprint > 0,
              },
              {
                id: 'pomodoro',
                name: 'Pomodoro (20–45m)',
                sess: `${sessionTierStats.pomodoro} sess`,
                pct: `${sessionTierStats.pomodoroPct}%`,
                pctNum: sessionTierStats.pomodoroPct,
                dotClass: 'dot-pomodoro',
                active: dominantTier === 'pomodoro' && sessionTierStats.pomodoro > 0,
              },
              {
                id: 'deepFlow',
                name: 'Deep Flow (45–90m)',
                sess: `${sessionTierStats.deepFlow} sess`,
                pct: `${sessionTierStats.deepFlowPct}%`,
                pctNum: sessionTierStats.deepFlowPct,
                dotClass: 'dot-deepflow',
                active: dominantTier === 'deepFlow' && sessionTierStats.deepFlow > 0,
              },
              {
                id: 'marathon',
                name: 'Marathon (>90m)',
                sess: `${sessionTierStats.marathon} sess`,
                pct: `${sessionTierStats.marathonPct}%`,
                pctNum: sessionTierStats.marathonPct,
                dotClass: 'dot-marathon',
                active: dominantTier === 'marathon' && sessionTierStats.marathon > 0,
              },
            ].map((tier) => (
              <div key={tier.id} className={`db-tier-card ${tier.active ? 'active-tier' : ''}`}>
                <div className="db-tier-meta">
                  <span className={`db-tier-dot ${tier.dotClass}`} />
                  <span>{tier.name}</span>
                </div>
                <div className="db-tier-val-flex">
                  <span className="db-tier-sess">{tier.sess}</span>
                  <span className="db-tier-pct">{tier.pct}</span>
                </div>
                {/* Visual Micro Progress Bar inside each sub-card */}
                <div className="db-tier-micro-track">
                  <div
                    className={`db-tier-micro-fill ${tier.dotClass}`}
                    style={{ width: `${tier.pctNum}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Bottom 4 Summary Metrics with Clean Dividers */}
          <div className="db-flow-bottom-stats">
            <div className="db-flow-stat-col">
              <div className="db-metric-label">AVG FOCUS DEPTH</div>
              <div className="db-metric-val">
                {avgFocusDepth > 0 ? fmtDur(avgFocusDepth) : '—'}
              </div>
            </div>
            <div className="db-flow-stat-col">
              <div className="db-metric-label">LONGEST SESSION</div>
              <div className="db-metric-val">
                {longestSession > 0 ? fmtDur(longestSession) : '—'}
              </div>
            </div>
            <div className="db-flow-stat-col">
              <div className="db-metric-label">CONTEXT SWITCHING</div>
              <div className="db-metric-val">{contextSwitching}</div>
            </div>
            <div className="db-flow-stat-col">
              <div className="db-metric-label">PEAK HOUR</div>
              <div className="db-metric-val">{peakHourLabel}</div>
            </div>
          </div>
        </div>

        {/* ROW 3: CIRCADIAN FOCUS WINDOW (LEFT) + DAY-OF-WEEK POWER RHYTHM (RIGHT) */}
        <div className="db-bento-grid-row db-two-col">
          {/* Circadian Focus Window */}
          <div className="db-card db-card-column">
            <div>
              <div className="db-card-header-flex mb-5">
                <h2 className="db-section-title">Circadian Focus Window</h2>
                <span className="db-section-meta">When you actually study</span>
              </div>

              <div className="db-circadian-grid">
                {circadianStats.slots.map((slot, i) => (
                  <div
                    key={i}
                    className={`db-circadian-card ${slot.active ? 'active-slot' : ''}`}
                    title={`${slot.title} (${slot.sub}): ${fmtDur(slot.secs)} · ${slot.pct}`}
                  >
                    <div className="db-circadian-top">
                      <span>{slot.title}</span>
                      <span className="db-circadian-hours">{slot.sub}</span>
                    </div>
                    <div className="db-circadian-val">{slot.val}</div>
                    <div className="db-circadian-bar-track">
                      {slot.active && (
                        <div
                          className="db-circadian-bar-fill"
                          style={{ width: `${Math.max(10, slot.pctNum)}%` }}
                        />
                      )}
                    </div>
                    <div className="db-circadian-pct">{slot.pct}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="db-insight-footer">
              <div className="db-insight-main">
                <span className="db-insight-icon"><Sparkles /></span>
                <span className="db-insight-label">Peak Cognitive Timing</span>
                <strong className="db-insight-value">{circadianStats.hasData ? circadianStats.bestSlotTitle : '—'}</strong>
              </div>
              <span className="db-insight-metric">
                {circadianStats.hasData ? `${circadianStats.bestPct}% of study` : '—'}
              </span>
            </div>
          </div>

          {/* Day-of-Week Power Rhythm */}
          <div className="db-card db-card-column">
            <div>
              <div className="db-card-header-flex mb-5">
                <h2 className="db-section-title">Day-of-Week Power Rhythm</h2>
                <span className="db-section-meta">Study output per weekday</span>
              </div>

              <div className="db-power-rhythm-list">
                {dayOfWeekStats.rows.map((row, i) => (
                    <div
                      key={i}
                      className="db-power-rhythm-row"
                      title={`${row.day}: ${row.val}`}
                    >
                    <span className={`db-power-day-label ${row.active ? 'active' : ''}`}>
                      {row.day}
                    </span>
                    <div className="db-power-track">
                      <div
                        className={`db-power-fill ${row.active ? 'active' : ''}`}
                        style={{ width: `${row.pct}%` }}
                      />
                    </div>
                    <span className={`db-power-val-label ${row.active ? 'active' : ''}`}>
                      {row.val}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="db-insight-footer">
              <div className="db-insight-main">
                <span className="db-insight-icon"><Zap /></span>
                <span className="db-insight-label">Power Day</span>
                <strong className="db-insight-value">{dayOfWeekStats.powerDayName}</strong>
              </div>
              <span className="db-insight-metric">
                {dayOfWeekStats.hasData ? `${dayOfWeekStats.powerDayVolume} total volume` : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* ROW 4: WEEKLY STUDY BAR CHART (LEFT) + PROJECT PORTFOLIO (RIGHT) */}
        <div className="db-bento-grid-row db-two-col">
          {/* Weekly Study Bar Chart */}
          <div className="db-card">
            <div className="db-card-header-flex mb-6">
              <h2 className="db-section-title">Weekly Study</h2>
              <span className="db-section-meta">
                Last 7 days · {weekBarData.totalWeeklyFmt} total · Peak: {weekBarData.peakDayLabel}{' '}
                ({weekBarData.peakDayFmt})
              </span>
            </div>

            {/* Zero Overlap Bar Chart Container with Headroom */}
            <div className="db-weekly-bar-chart-stage">
              {weekBarData.cols.map((col, i) => (
                  <div
                    key={i}
                    className="db-weekly-bar-column"
                    title={`${col.day}: ${col.label || 'No study logged'}`}
                    aria-label={`${col.day}: ${col.label || 'No study logged'}`}
                  >
                  {col.label ? (
                    <span className={`db-weekly-bar-val-text ${col.active ? 'active' : ''}`}>
                      {col.label}
                    </span>
                  ) : (
                    <span className="db-weekly-bar-val-spacer" />
                  )}
                  <div
                    className={`db-weekly-bar-element ${col.active ? 'active' : ''} ${
                      col.muted ? 'muted' : ''
                    }`}
                    style={{ height: `${Math.max(col.val > 0 ? 8 : 0, col.h)}%` }}
                  />
                </div>
              ))}
            </div>

            <div className="db-weekly-bar-days-footer">
              {weekBarData.cols.map((col, idx) => (
                <span
                  key={idx}
                  className={`db-weekly-day-item ${col.active ? 'active' : ''}`}
                >
                  {col.day}
                </span>
              ))}
            </div>
          </div>

          {/* Project Portfolio */}
          <div className="db-card db-card-column">
            <div>
              <div className="db-card-header-flex mb-6">
                <h2 className="db-section-title">Project Portfolio</h2>
                <div className="db-portfolio-range-pills">
                  {['Today', 'Week', 'Month', 'All time'].map((t) => (
                    <button
                      key={t}
                      onClick={() => setPortfolioRange(t)}
                      className={`db-portfolio-pill ${portfolioRange === t ? 'active' : ''}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Project Items */}
              {portfolioStats.list.length === 0 ? (
                <div className="db-portfolio-empty">
                  <p>No study logged for this range.</p>
                  <button onClick={() => onNavigate?.('timer')} className="db-portfolio-timer-btn">
                    Start a session
                  </button>
                </div>
              ) : (
                <div className="db-portfolio-list">
                  {portfolioStats.list.map((item, idx) => (
                    <div
                      key={idx}
                      className="db-portfolio-item"
                      title={`${item.projectName}${item.subjectName ? ` · ${item.subjectName}` : ''}: ${item.durationFmt} across ${item.count} ${item.count === 1 ? 'session' : 'sessions'}`}
                    >
                      <div className="db-portfolio-item-meta">
                        <div className="db-portfolio-item-name-group">
                          <span
                            className="db-portfolio-dot"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="db-portfolio-item-title">
                            {item.projectName}
                            {item.subjectName ? ` · ${item.subjectName}` : ''}
                          </span>
                        </div>
                        <div className="db-portfolio-item-stats">
                          <span className="db-portfolio-sess-count">
                            {item.count} {item.count === 1 ? 'session' : 'sessions'}
                          </span>
                          <span className="db-portfolio-duration">{item.durationFmt}</span>
                        </div>
                      </div>
                      <div className="db-portfolio-bar-track">
                        <div
                          className="db-portfolio-bar-fill"
                          style={{
                            width: `${item.pct}%`,
                            background: `linear-gradient(to right, ${item.color}, var(--db-portfolio-accent))`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="db-portfolio-footer">
              <span>Top focused subject accounts for {portfolioStats.topPct}% of logged study</span>
              <span className="accent">
                {portfolioStats.totalProjects} active{' '}
                {portfolioStats.totalProjects === 1 ? 'project' : 'projects'}
              </span>
            </div>
          </div>
        </div>

        {/* Study trend charts */}
        <section className="db-chart-section" aria-labelledby="db-study-patterns-title">
          <div className="db-chart-section-heading">
            <div>
              <h2 id="db-study-patterns-title">Study patterns</h2>
              <p>Daily output, weekly momentum, and session length</p>
            </div>
          </div>
          <DailyHoursGraph days={dailyHoursData.days} title={dailyHoursData.title} />
          <div className="db-bento-grid-row db-two-col db-chart-pair">
            <WeeklyTrendGraph weeks={weeklyTrendData} />
            <SessionLengthGraph buckets={sessionLengthData} />
          </div>
        </section>

        {/* ROW 5: TIME-OF-DAY HEATMAP (24H x 7 DAYS) */}
        <div className="db-card">
          <div className="db-card-header-flex mb-5">
            <h2 className="db-section-title">Time-of-Day Heatmap</h2>
            <span className="db-section-meta">Study hours by day and hour</span>
          </div>

          <div className="db-heatmap-scroll">
            <div className="db-heatmap-matrix-min">
              {/* Hour Headers */}
              <div className="db-heatmap-hour-headers">
                <div className="db-heatmap-hour-spacer" />
                {Array.from({ length: 24 }).map((_, h) => (
                  <div key={h} className="db-heatmap-hour-tag">
                    {h % 3 === 0 ? `${h}h` : ''}
                  </div>
                ))}
              </div>

              {/* 7 Day Rows */}
              <div className="db-heatmap-rows-stack">
                {heatmapStats.days.map((day, dayIdx) => (
                  <div key={day} className="db-heatmap-day-row">
                    <span className="db-heatmap-day-label">{day}</span>
                    {Array.from({ length: 24 }).map((_, h) => {
                      const secs = heatmapStats.matrix[dayIdx][h];
                      const isPeak =
                        secs > 0 &&
                        dayIdx === heatmapStats.peakDayIdx &&
                        h === heatmapStats.peakHour;
                      const hasStudy = secs > 0;
                      const opacity = hasStudy
                        ? Math.min(1, Math.max(0.25, secs / heatmapStats.maxCell))
                        : 0;

                      return (
                        <div
                          key={h}
                          title={`${day} ${h}:00 · ${secs > 0 ? fmtDur(secs) : 'No study'}`}
                          className={`db-heatmap-slot ${isPeak ? 'peak-slot' : ''} ${
                            hasStudy ? 'study-slot' : 'empty-slot'
                          }`}
                          style={hasStudy && !isPeak ? { opacity } : {}}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ROW 6: 52-WEEK ACTIVITY CALENDAR */}
        <div className="db-card">
          <div className="db-card-header-flex mb-5">
            <h2 className="db-section-title">Activity Calendar</h2>
            <span className="db-section-meta">
              52 weeks · {activityCalStats.activeDaysCount} active days · {fmtDur(allSecs)} logged
            </span>
          </div>

          <div className="db-activity-cal-scroll">
            <div className="db-activity-cal-min">
              {/* Month Labels */}
              <div className="db-activity-cal-months">
                {activityCalStats.monthNames.map((m, idx) => (
                  <span key={idx}>{m}</span>
                ))}
              </div>

              <div className="db-activity-cal-body">
                {/* Weekday Labels */}
                <div className="db-activity-cal-weekdays">
                  <span>Mon</span>
                  <span>Wed</span>
                  <span>Fri</span>
                </div>

                {/* 52x7 Contribution Grid */}
                <div className="db-activity-cal-grid">
                  {activityCalStats.weeks.map((week, weekIdx) => (
                    <div key={weekIdx} className="db-activity-cal-week-col">
                      {week.map((day, dayIdx) => {
                        if (!day) {
                          return (
                            <div
                              key={dayIdx}
                              className="db-activity-cal-cell empty-ghost"
                            />
                          );
                        }
                        const hasVal = day.val > 0;
                        const isMax = day.val > 0 && day.val === activityCalStats.maxVal;
                        const op = hasVal
                          ? Math.min(1, Math.max(0.3, day.val / activityCalStats.maxVal))
                          : 0;

                        return (
                          <div
                            key={dayIdx}
                            title={`${day.dateStr} · ${day.val > 0 ? fmtDur(day.val) : 'No study'}`}
                            className={`db-activity-cal-cell ${
                              day.isToday ? 'is-today-ring' : ''
                            } ${isMax ? 'is-max' : hasVal ? 'is-active' : 'is-empty'}`}
                            style={hasVal && !isMax ? { opacity: op } : {}}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
