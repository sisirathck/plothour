import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, Check, ChevronDown, LoaderCircle, Settings2, Users, Share2, ChevronUp, Info, Image as ImageIcon } from 'lucide-react';
import './Compare.css';
import { formatDisplayDate } from '../../utils/dateFormat';
import { getSiteFontStyle, useSiteCustomization } from '../../context/SiteCustomizationContext';

const RANGE_OPTIONS = [
  { id: 'today', label: 'Today' }, { id: '7days', label: 'Last 7 days' }, { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' }, { id: '30days', label: 'Last 30 days' }, { id: '90days', label: 'Last 90 days' },
  { id: 'all', label: 'All time' }, { id: 'custom', label: 'Custom' },
];
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const metricHelp = {
  'Streak at period end': 'Consecutive days studied through the last day in this period.',
  'Longest streak': 'The longest consecutive run of study days in this period.',
  'Average per active day': 'Study time divided by days with at least one session.',
  'Average session': 'Total study time divided by completed sessions.',
  'Longest session': 'The longest single session recorded in this period.',
  'Peak study hour': 'The clock hour containing the most logged study time.',
};
const patternHelp = {
  'Average session': 'Total study time divided by the number of sessions.',
  'Sessions / calendar day': 'Sessions divided by all days in the selected period, including rest days.',
  'Median active day': 'The middle daily total after sorting days with study time.',
  'Average / active day': 'Total study time divided by days with at least one session.',
  '45+ min session share': 'The percentage of sessions lasting at least 45 minutes.',
  'Sessions under 15 min': 'A count of sessions shorter than 15 minutes.',
  '30+ min days': 'Days with at least 30 minutes of recorded study.',
  'Days at daily goal': 'Days that reached the combined daily goals set for the study areas.',
  'Weekday / weekend time': 'The share of study time logged Monday through Friday versus weekends.',
};
const profileColor = (id) => `var(--compare-profile-${String(id).replace(/[^a-zA-Z0-9_-]/g, '')})`;
const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const duration = (seconds, empty = '0m') => {
  if (!seconds || seconds <= 0) return empty;
  const mins = Math.floor(seconds / 60); const hours = Math.floor(mins / 60); const rest = mins % 60;
  return hours ? `${hours}h ${rest}m` : `${mins}m`;
};
const prettyDate = (value) => value ? formatDisplayDate(new Date(`${value}T12:00:00`), { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const compactDate = (value) => value ? formatDisplayDate(new Date(`${value}T12:00:00`), { month: '2-digit', day: '2-digit' }) : '—';
const readJson = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; } };
const escapeSvg = (value) => String(value).replace(/[&<>\"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]);

async function createRecapImage({ name, period, metrics }) {
  const root = document.querySelector('.compare-page');
  const styles = getComputedStyle(root || document.documentElement);
  const color = (name, fallback) => styles.getPropertyValue(name).trim() || fallback;
  const background = color('--compare-card', '#171923');
  const textColor = color('--compare-text', '#f6f5fb');
  const muted = color('--compare-muted', '#a3a2b5');
  const line = color('--compare-line', '#343647');
  const accent = color('--compare-accent', '#f58c76');
  const height = 360 + metrics.length * 82;
  const rows = metrics.map(([label, value], index) => {
    const y = 265 + index * 82;
    return `<g><text x="92" y="${y}" fill="${escapeSvg(muted)}" font-family="Arial,sans-serif" font-size="24">${escapeSvg(label)}</text><text x="988" y="${y}" fill="${escapeSvg(textColor)}" font-family="Arial,sans-serif" font-size="30" font-weight="700" text-anchor="end">${escapeSvg(value)}</text><line x1="92" y1="${y + 27}" x2="988" y2="${y + 27}" stroke="${escapeSvg(line)}" stroke-width="2" opacity=".72"/></g>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="${height}" viewBox="0 0 1080 ${height}"><rect width="1080" height="${height}" rx="38" fill="${escapeSvg(background)}"/><rect x="0" y="0" width="1080" height="18" rx="9" fill="${escapeSvg(accent)}"/><text x="92" y="92" fill="${escapeSvg(accent)}" font-family="Arial,sans-serif" font-size="20" font-weight="700" letter-spacing="4">PLOTHOUR · STUDY RECAP</text><text x="92" y="157" fill="${escapeSvg(textColor)}" font-family="Arial,sans-serif" font-size="42" font-weight="700">${escapeSvg(name)}</text><text x="92" y="202" fill="${escapeSvg(muted)}" font-family="Arial,sans-serif" font-size="25">${escapeSvg(period)}</text><line x1="92" y1="232" x2="988" y2="232" stroke="${escapeSvg(line)}" stroke-width="2"/>${rows}<text x="92" y="${height - 42}" fill="${escapeSvg(muted)}" font-family="Arial,sans-serif" font-size="18">A little progress, logged consistently.</text></svg>`;
  const svgUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = new window.Image();
    image.src = svgUrl;
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; });
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = height;
    canvas.getContext('2d').drawImage(image, 0, 0);
    return await new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not render recap image')), 'image/png'));
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

function getPeriod(range, from, to, weekStart) {
  const now = new Date(); const end = new Date(now); const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (range === '7days') start.setDate(start.getDate() - 6);
  else if (range === 'week') start.setDate(start.getDate() - ((start.getDay() - weekStart + 7) % 7));
  else if (range === 'month') start.setDate(1);
  else if (range === '30days') start.setDate(start.getDate() - 29);
  else if (range === '90days') start.setDate(start.getDate() - 89);
  else if (range === 'all') start.setTime(0);
  else if (range === 'custom') {
    const a = from ? new Date(`${from}T00:00:00`) : start; const b = to ? new Date(`${to}T23:59:59.999`) : end;
    return { start: Number.isNaN(a.getTime()) ? start : a, end: Number.isNaN(b.getTime()) ? end : new Date(Math.min(b.getTime(), end.getTime())) };
  }
  start.setHours(0, 0, 0, 0); return { start, end };
}
const getPrevious = ({ start, end }) => { const length = Math.max(0, end - start); return { start: new Date(start - length - 1), end: new Date(start - 1) }; };

function daySeries(profiles, start, end) {
  const totalDays = Math.max(1, Math.floor((new Date(end.getFullYear(), end.getMonth(), end.getDate()) - new Date(start.getFullYear(), start.getMonth(), start.getDate())) / 86400000) + 1);
  const limit = Math.min(totalDays, 90); const first = new Date(start.getFullYear(), start.getMonth(), start.getDate()); first.setDate(first.getDate() + totalDays - limit);
  const dates = Array.from({ length: limit }, (_, i) => { const d = new Date(first); d.setDate(first.getDate() + i); return dateKey(d); });
  const byProfile = Object.fromEntries(profiles.map((p) => [p.id, Object.fromEntries(p.daily.map((d) => [d.date, d.seconds]))]));
  return { dates, byProfile, truncated: totalDays > limit };
}
function weeklySeries(profiles, dates, weekStart) {
  const map = new Map();
  profiles.forEach((p) => p.daily.forEach(({ date, seconds }) => {
    const day = new Date(`${date}T12:00:00`); day.setDate(day.getDate() - ((day.getDay() - weekStart + 7) % 7));
    const key = dateKey(day); if (!map.has(key)) map.set(key, {}); map.get(key)[p.id] = (map.get(key)[p.id] || 0) + seconds;
  }));
  const first = new Date(`${dates[0]}T12:00:00`); first.setDate(first.getDate() - ((first.getDay() - weekStart + 7) % 7));
  const last = new Date(`${dates.at(-1)}T12:00:00`); last.setDate(last.getDate() - ((last.getDay() - weekStart + 7) % 7));
  const weeks = []; for (let d = first; d <= last && weeks.length < 13; d.setDate(d.getDate() + 7)) { const key = dateKey(d); weeks.push({ key, totals: map.get(key) || {} }); }
  return weeks.slice(-12);
}

function summarizeLocalProfile(source, start, end, previous, range, calendarDays, projects = []) {
  const entries = (Array.isArray(source.entries) ? source.entries : []).filter((entry) => Number(entry.startedAt) >= start.getTime() && Number(entry.startedAt) <= end.getTime());
  const previousEntries = (Array.isArray(source.entries) ? source.entries : []).filter((entry) => Number(entry.startedAt) >= previous.start.getTime() && Number(entry.startedAt) <= previous.end.getTime());
  const dailyMap = new Map(); const sessions = entries.map((entry) => Number(entry.durationSeconds) || 0); const projectTotals = new Map();
  entries.forEach((entry) => {
    const date = dateKey(new Date(Number(entry.startedAt))); dailyMap.set(date, (dailyMap.get(date) || 0) + (Number(entry.durationSeconds) || 0));
    const label = entry.subjectName || entry.projectName || 'General Study'; projectTotals.set(label, (projectTotals.get(label) || 0) + (Number(entry.durationSeconds) || 0));
  });
  const daily = [...dailyMap].map(([date, seconds]) => ({ date, seconds, sessions: entries.filter((entry) => dateKey(new Date(Number(entry.startedAt))) === date).length })).sort((a, b) => a.date.localeCompare(b.date));
  const seconds = sessions.reduce((sum, value) => sum + value, 0); const activeDays = daily.length; const dayValues = daily.map((day) => day.seconds).sort((a, b) => a - b);
  const median = dayValues.length ? dayValues.length % 2 ? dayValues[Math.floor(dayValues.length / 2)] : Math.round((dayValues[dayValues.length / 2 - 1] + dayValues[dayValues.length / 2]) / 2) : 0;
  const goalSeconds = range === 'all' ? 0 : projects.filter((project) => !project.archived).reduce((sum, project) => sum + (project.subjects || []).reduce((subtotal, subject) => {
    const goal = subject.goals || {};
    if (range === 'today') return subtotal + (Number(goal.daily) || 0) * 3600;
    if (range === 'week') return subtotal + (Number(goal.weekly) || 0) * 3600;
    if (range === 'month') return subtotal + (Number(goal.monthly) || 0) * 3600;
    return subtotal + (Number(goal.daily) || 0) * calendarDays * 3600;
  }, 0), 0);
  const goalDays = projects.length ? daily.filter((day) => {
    const target = projects.filter((project) => !project.archived).reduce((sum, project) => sum + (project.subjects || []).reduce((n, subject) => n + (Number(subject.goals?.daily) || 0), 0), 0) * 3600;
    return target > 0 && day.seconds >= target;
  }).length : 0;
  const orderedDays = [...daily].sort((a, b) => a.date.localeCompare(b.date)); let longestStreak = 0; let run = 0; let previousDate = '';
  orderedDays.forEach((day) => { const serial = Math.floor(new Date(`${day.date}T00:00:00Z`).getTime() / 86400000); run = previousDate && serial - previousDate === 1 ? run + 1 : 1; previousDate = serial; longestStreak = Math.max(longestStreak, run); });
  const streakAtEnd = orderedDays.at(-1)?.date === dateKey(end) ? run : 0;
  const bestDay = [...daily].sort((a, b) => b.seconds - a.seconds)[0] || null; const longestSession = [...entries].sort((a, b) => b.durationSeconds - a.durationSeconds)[0] || null;
  const peakHours = new Map(); let weekdaySeconds = 0;
  entries.forEach((entry) => { const date = new Date(Number(entry.startedAt)); const hour = date.getHours(); peakHours.set(hour, (peakHours.get(hour) || 0) + (Number(entry.durationSeconds) || 0)); if (![0, 6].includes(date.getDay())) weekdaySeconds += Number(entry.durationSeconds) || 0; });
  const peakHour = [...peakHours].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const recentToday = new Date(); const recentFrom = new Date(recentToday.getFullYear(), recentToday.getMonth(), recentToday.getDate() - 6).getTime();
  const recentTo = recentToday.getTime(); const recentTotals = new Map();
  (Array.isArray(source.entries) ? source.entries : []).filter((entry) => Number(entry.startedAt) >= recentFrom && Number(entry.startedAt) <= recentTo).forEach((entry) => {
    const date = dateKey(new Date(Number(entry.startedAt))); recentTotals.set(date, (recentTotals.get(date) || 0) + (Number(entry.durationSeconds) || 0));
  });
  return {
    id: source.id, name: source.name,
    current: { seconds, activeDays, sessions: entries.length, averageActiveDaySeconds: activeDays ? Math.round(seconds / activeDays) : 0, averageSessionSeconds: entries.length ? Math.round(seconds / entries.length) : 0, sessionsPerCalendarDay: entries.length / Math.max(1, calendarDays), medianActiveDaySeconds: median, longSessionShare: entries.length ? entries.filter((entry) => entry.durationSeconds >= 2700).length / entries.length : 0, shortSessions: entries.filter((entry) => entry.durationSeconds < 900).length, thirtyMinuteDays: dayValues.filter((value) => value >= 1800).length, goalDays, goalSeconds, goalProgressPct: goalSeconds ? Math.round(seconds / goalSeconds * 100) : null, weekdaySeconds, weekendSeconds: seconds - weekdaySeconds, streakAtEnd, longestStreak, bestDay, longestSession: longestSession ? { seconds: longestSession.durationSeconds, date: dateKey(new Date(Number(longestSession.startedAt))) } : null, peakHour, projectBreakdown: [...projectTotals].map(([name, value]) => ({ name, seconds: value })).sort((a, b) => b.seconds - a.seconds) },
    previous: { seconds: previousEntries.reduce((sum, entry) => sum + (Number(entry.durationSeconds) || 0), 0) }, daily,
    recentDaily: [...recentTotals].map(([date, value]) => ({ date, seconds: value })).sort((a, b) => a.date.localeCompare(b.date)),
  };
}

function PatternMetrics({ profile }) {
  const c = profile.current; const split = c.seconds ? `${Math.round(c.weekdaySeconds / c.seconds * 100)}% / ${Math.round(c.weekendSeconds / c.seconds * 100)}%` : '—';
  const rows = [
    ['Average session', duration(c.averageSessionSeconds, '—')], ['Sessions / calendar day', (c.sessionsPerCalendarDay || 0).toFixed(1)],
    ['Median active day', duration(c.medianActiveDaySeconds, '—')], ['Average / active day', duration(c.averageActiveDaySeconds, '—')],
    ['45+ min session share', `${Math.round((c.longSessionShare || 0) * 100)}%`], ['Sessions under 15 min', String(c.shortSessions || 0)],
    ['30+ min days', String(c.thirtyMinuteDays || 0)], ['Days at daily goal', String(c.goalDays || 0)], ['Weekday / weekend time', split],
  ];
  return <dl>{rows.map(([label, value]) => <div key={label}><dt title={patternHelp[label] || label}>{label}<Info size={11} aria-hidden="true" /></dt><dd>{value}</dd></div>)}</dl>;
}

function DailyCharts({ profiles, dates, byProfile }) {
  if (!dates.length) return null;
  const width = 900; const height = 230; const pad = { l: 46, r: 22, t: 18, b: 34 }; const chartW = width - pad.l - pad.r; const chartH = height - pad.t - pad.b;
  const totals = profiles.flatMap((p) => dates.map((d) => byProfile[p.id]?.[d] || 0)); const max = Math.max(3600, ...totals); const cumulative = Object.fromEntries(profiles.map((p) => [p.id, 0]));
  const cumulativePoints = Object.fromEntries(profiles.map((p) => [p.id, []]));
  dates.forEach((d) => profiles.forEach((p) => { cumulative[p.id] += byProfile[p.id]?.[d] || 0; cumulativePoints[p.id].push(cumulative[p.id]); }));
  const cumulativeMax = Math.max(3600, ...Object.values(cumulativePoints).flat());
  const point = (i, value, limit) => [pad.l + (dates.length < 2 ? chartW / 2 : i * chartW / (dates.length - 1)), pad.t + chartH - (value / limit) * chartH];
  const smoothPath = (points) => points.reduce((path, current, i) => {
    if (i === 0) return `M ${current[0]} ${current[1]}`;
    const previous = points[i - 1]; const midX = (previous[0] + current[0]) / 2;
    return `${path} C ${midX} ${previous[1]}, ${midX} ${current[1]}, ${current[0]} ${current[1]}`;
  }, '');
  const safeId = (id) => String(id).replace(/[^a-zA-Z0-9_-]/g, '-');
  const tickIndices = [...new Set([0, Math.floor((dates.length - 1) / 3), Math.floor((dates.length - 1) * 2 / 3), dates.length - 1])];
  const baselineY = pad.t + chartH;
  return <div className="compare-chart-stack">
    <article className="compare-section-card compare-chart-card"><div className="compare-section-heading"><div><span className="compare-eyebrow">CUMULATIVE STUDY TIME</span><h2>Cumulative hours over time</h2><p>{dates.length} calendar days{dates.length === 90 ? ' · latest 90 days' : ''}</p></div><Legend profiles={profiles} /></div>
      <svg className="compare-line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Cumulative study time by profile">
        <defs>{profiles.map((p) => <linearGradient key={p.id} id={`compare-area-${safeId(p.id)}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={profileColor(p.id)} stopOpacity=".16" /><stop offset="100%" stopColor={profileColor(p.id)} stopOpacity="0" /></linearGradient>)}</defs>
        <ChartGrid pad={pad} chartH={chartH} max={cumulativeMax} />
        {profiles.map((p) => {
          const values = cumulativePoints[p.id]; const pts = values.map((v, i) => point(i, v, cumulativeMax)); const line = smoothPath(pts);
          const area = `${line} L ${pts.at(-1)[0]} ${baselineY} L ${pts[0][0]} ${baselineY} Z`;
          const markers = [...new Set([...tickIndices, dates.length - 1])];
          return <g key={p.id} className="compare-cumulative-series"><path d={area} fill={`url(#compare-area-${safeId(p.id)})`} /><path d={line} fill="none" stroke={profileColor(p.id)} strokeWidth="2.75" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />{markers.map((i) => <circle key={i} className="compare-line-point" cx={pts[i][0]} cy={pts[i][1]} r="3" fill="var(--compare-card)" stroke={profileColor(p.id)} strokeWidth="2" />)}</g>;
        })}
        {tickIndices.map((i) => <text className="compare-axis-label" key={i} x={point(i, 0, cumulativeMax)[0]} y={height - 8} textAnchor="middle">{compactDate(dates[i])}</text>)}
      </svg>
    </article>
    <article className="compare-section-card compare-chart-card"><div className="compare-section-heading"><div><span className="compare-eyebrow">STUDY TIME BY PERIOD</span><h2>Daily study time</h2><p>Daily totals in the selected period{dates.length === 90 ? ' · latest 90 days' : ''}</p></div><Legend profiles={profiles} /></div>
      <div className="compare-grouped-chart" style={{ '--chart-count': dates.length, '--profile-count': profiles.length }}>{dates.map((day, i) => <div className="compare-group-column" key={day} title={prettyDate(day)}><div className="compare-group-bars">{profiles.map((p) => { const v = byProfile[p.id]?.[day] || 0; return <i key={p.id} title={`${p.name} · ${prettyDate(day)}: ${duration(v, '0m')}`} aria-label={`${p.name}, ${prettyDate(day)}: ${duration(v, '0m')}`} tabIndex={v ? 0 : -1} style={{ height: `${v / max * 100}%`, '--profile-color': profileColor(p.id) }} />; })}</div><span>{tickIndices.includes(i) ? compactDate(day) : ''}</span></div>)}</div>
    </article>
  </div>;
}
function ChartGrid({ pad, chartH, max }) {
  return <g className="compare-grid-lines">{[0, 1, 2, 3].map((i) => { const y = pad.t + chartH - chartH * i / 3; return <g key={i}><line x1={pad.l} x2="878" y1={y} y2={y} /><text className="compare-axis-label" x={pad.l - 9} y={y + 3.5} textAnchor="end">{duration(max * i / 3, '0m')}</text></g>; })}</g>;
}
function Legend({ profiles }) { return <div className="compare-legend">{profiles.map((p, i) => <span key={p.id}><i style={{ '--profile-color': profileColor(p.id) }} />{p.name}</span>)}</div>; }

export const ComparePage = ({ user, onNavigate }) => {
  const { config, text } = useSiteCustomization();
  const demoMode = !user?.id && localStorage.getItem('studyduel_demo_mode') === 'true';
  const profileId = user?.id ? String(user.id) : demoMode ? 'demo-profile' : '';
  const preferencesKey = user?.id ? `studyduel_user_${user.id}_preferences` : demoMode ? 'studyduel_demo_preferences' : '';
  const rangeKey = user?.id ? `studyduel_user_${user.id}_dashboard_preferences_range_v2` : demoMode ? 'studyduel_demo_dashboard_preferences_range_v2' : '';
  const detailsKey = user?.id ? `studyduel_user_${user.id}_compare_details` : demoMode ? 'studyduel_demo_compare_details' : '';
  const compareSelectionKey = user?.id ? `studyduel_user_${user.id}_compare_profiles` : demoMode ? 'studyduel_demo_compare_profiles_selected' : '';
  const colorStorageKey = user?.id ? `studyduel_user_${user.id}_compare_profile_colors` : demoMode ? 'studyduel_demo_compare_profile_colors' : '';
  const [connections, setConnections] = useState([]); const [selectedIds, setSelectedIds] = useState(() => {
    if (!profileId) return [];
    try {
      const saved = JSON.parse(localStorage.getItem(compareSelectionKey) || 'null');
      if (Array.isArray(saved)) return [...new Set([profileId, ...saved])];
      if (demoMode) return [...new Set([profileId, ...readJson('studyduel_demo_friends', []).map((friend) => friend.id)])];
      return [profileId];
    } catch { return [profileId]; }
  });
  const [manageViewOpen, setManageViewOpen] = useState(false); const [range, setRange] = useState(() => { const saved = rangeKey ? localStorage.getItem(rangeKey) : null; return RANGE_OPTIONS.some((item) => item.id === saved) ? saved : 'week'; });
  const [showDetails, setShowDetails] = useState(() => readJson(detailsKey, {})?.expanded === true);
  const [shareStatus, setShareStatus] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [shareFields, setShareFields] = useState(['time', 'activeDays', 'sessions']);
  const [colorSelections, setColorSelections] = useState(() => readJson(colorStorageKey, {}));
  const [rangeOpen, setRangeOpen] = useState(false);
  const [customStart, setCustomStart] = useState(() => dateKey(new Date(new Date().getFullYear(), new Date().getMonth(), 1))); const [customEnd, setCustomEnd] = useState(() => dateKey(new Date()));
  const [connectionError, setConnectionError] = useState(''); const [dataError, setDataError] = useState(''); const [loading, setLoading] = useState(false); const [profiles, setProfiles] = useState([]);
  useEffect(() => {
    setShowDetails(readJson(detailsKey, {})?.expanded === true);
  }, [detailsKey]);
  const toggleDetails = () => {
    const expanded = !showDetails;
    setShowDetails(expanded);
    if (detailsKey) {
      try { localStorage.setItem(detailsKey, JSON.stringify({ expanded })); } catch {}
    }
  };
  useEffect(() => {
    if (!shareOpen && !manageViewOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setShareOpen(false);
        setManageViewOpen(false);
      }
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [shareOpen, manageViewOpen]);
  useEffect(() => { if (rangeKey) { try { localStorage.setItem(rangeKey, range); } catch {} } }, [rangeKey, range]);
  useEffect(() => { if (compareSelectionKey && selectedIds.length) { try { localStorage.setItem(compareSelectionKey, JSON.stringify(selectedIds)); } catch {} } }, [compareSelectionKey, selectedIds]);
  useEffect(() => { if (colorStorageKey) { try { localStorage.setItem(colorStorageKey, JSON.stringify(colorSelections)); } catch {} } }, [colorStorageKey, colorSelections]);
  useEffect(() => {
    if (demoMode) {
      const demoConnections = readJson('studyduel_demo_friends', []);
      setConnections(demoConnections);
      const connectedIds = new Set(demoConnections.map((friend) => friend.id));
      setSelectedIds((current) => [...new Set([profileId, ...current.filter((id) => id !== profileId && connectedIds.has(id))])]);
      setColorSelections((current) => ({ ...current, [profileId]: Number.isInteger(current[profileId]) ? current[profileId] : 0, ...Object.fromEntries(demoConnections.map((friend, index) => [friend.id, Number.isInteger(current[friend.id]) ? current[friend.id] : (index + 1) % 12])) }));
      return undefined;
    }
    if (!profileId) { setConnections([]); setSelectedIds([]); return undefined; }
    let cancelled = false;
    fetch('/api/connections', { credentials: 'same-origin' }).then(async (r) => { const data = await r.json().catch(() => ({})); if (!r.ok) throw new Error(data.error || 'Could not load study partners.'); if (!cancelled) { const next = data.connections || []; setConnections(next); setSelectedIds((current) => [...new Set([profileId, ...current.filter((id) => next.some((c) => c.id === id))])]); setColorSelections((current) => ({ ...current, [profileId]: Number.isInteger(current[profileId]) ? current[profileId] : 0, ...Object.fromEntries(next.map((friend, index) => [friend.id, Number.isInteger(current[friend.id]) ? current[friend.id] : (index + 1) % 12])) })); } }).catch((e) => { if (!cancelled) setConnectionError(e.message); });
    return () => { cancelled = true; };
  }, [profileId, demoMode]);
  const weekStartPref = preferencesKey ? (readJson(preferencesKey, {})?.weekStart || 'monday') : 'monday';
  const weekStartsOn = Number.isInteger(user?.week_starts_on) ? user.week_starts_on : Math.max(0, WEEKDAYS.indexOf(weekStartPref));
  const period = useMemo(() => getPeriod(range, customStart, customEnd, weekStartsOn), [range, customStart, customEnd, weekStartsOn]); const previous = useMemo(() => getPrevious(period), [period]);
  const recentHeadToHeadEnd = new Date();
  recentHeadToHeadEnd.setHours(23, 59, 59, 999);
  const recentHeadToHeadStart = new Date(recentHeadToHeadEnd.getFullYear(), recentHeadToHeadEnd.getMonth(), recentHeadToHeadEnd.getDate() - 6);
  const recentDates = Array.from({ length: 7 }, (_, index) => { const date = new Date(recentHeadToHeadStart); date.setDate(date.getDate() + index); return dateKey(date); });
  useEffect(() => {
    if (!profileId || !selectedIds.length) { setProfiles([]); return undefined; }
    if (demoMode) {
      const ownerEntries = readJson('studyduel_demo_time_entries', []);
      const ownerPreferences = readJson('studyduel_demo_preferences', {});
      const demoProjects = readJson('studyduel_demo_projects', []);
      const connectedIds = new Set(connections.map((connection) => connection.id));
      const sources = [{ id: 'demo-profile', name: ownerPreferences.displayName || 'You', entries: ownerEntries }, ...readJson('studyduel_demo_compare_profiles', []).filter((source) => connectedIds.has(source.id))];
      const days = Math.max(1, Math.floor((new Date(period.end.getFullYear(), period.end.getMonth(), period.end.getDate()) - new Date(period.start.getFullYear(), period.start.getMonth(), period.start.getDate())) / 86400000) + 1);
      setProfiles(sources.filter((source) => selectedIds.includes(source.id)).map((source) => summarizeLocalProfile(source, period.start, period.end, previous, range, days, demoProjects)));
      setLoading(false); setDataError('');
      return undefined;
    }
    let cancelled = false; setLoading(true); setDataError('');
    const days = Math.max(1, Math.floor((new Date(period.end.getFullYear(), period.end.getMonth(), period.end.getDate()) - new Date(period.start.getFullYear(), period.start.getMonth(), period.start.getDate())) / 86400000) + 1);
    const params = new URLSearchParams({ profileIds: selectedIds.join(','), from: String(period.start.getTime()), to: String(period.end.getTime()), previousFrom: String(previous.start.getTime()), previousTo: String(previous.end.getTime()), calendarDays: String(days), rangeType: range, weekStartsOn: String(weekStartsOn), recentFrom: String(recentHeadToHeadStart.getTime()), recentTo: String(recentHeadToHeadEnd.getTime()) });
    fetch(`/api/connections/comparison?${params}`, { credentials: 'same-origin' }).then(async (r) => { const data = await r.json().catch(() => ({})); if (!r.ok) throw new Error(data.error || 'Could not load comparison data.'); if (!cancelled) setProfiles(data.profiles || []); }).catch((e) => { if (!cancelled) { setProfiles([]); setDataError(e.message); } }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [profileId, demoMode, connections, selectedIds, period.start.getTime(), period.end.getTime(), previous.start.getTime(), previous.end.getTime(), range, weekStartsOn, recentHeadToHeadStart.getTime(), recentHeadToHeadEnd.getTime()]);
  const ordered = useMemo(() => [...profiles].sort((a, b) => b.current.seconds - a.current.seconds || a.name.localeCompare(b.name)), [profiles]);
  const periodLabel = RANGE_OPTIONS.find((item) => item.id === range)?.label || 'This week'; const periodDescription = range === 'all' ? `All time through ${formatDisplayDate(period.end, { day: 'numeric', month: 'short', year: 'numeric' })}` : `${formatDisplayDate(period.start, { day: 'numeric', month: 'short', year: 'numeric' })} → ${formatDisplayDate(period.end, { day: 'numeric', month: 'short', year: 'numeric' })}`;
  const series = useMemo(() => daySeries(profiles, period.start, period.end), [profiles, period.start.getTime(), period.end.getTime()]);
  const weeks = useMemo(() => weeklySeries(profiles, series.dates, weekStartsOn), [profiles, series.dates.join(','), weekStartsOn]);
  const maxWeek = Math.max(1, ...weeks.map((w) => Object.values(w.totals).reduce((a, b) => a + b, 0)));
  const selectedConnections = connections.filter((connection) => selectedIds.includes(connection.id));
  const toggle = (id) => { if (id === profileId) return; setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]); };
  const change = (p) => { const delta = p.current.seconds - p.previous.seconds; if (range === 'all') return '—'; if (!delta) return '0m'; return `${delta > 0 ? '+' : '−'}${duration(Math.abs(delta))}`; };
  const allDates = series.dates; const dailyTotals = Object.fromEntries(profiles.map((p) => [p.id, Object.fromEntries(p.daily.map((d) => [d.date, d.seconds]))]));
  const raceProfiles = ordered.filter((p) => p.current.goalSeconds > 0);
  const dayWinners = allDates.map((date) => { const ranked = profiles.map((p) => ({ p, seconds: dailyTotals[p.id]?.[date] || 0 })).filter((x) => x.seconds > 0).sort((a, b) => b.seconds - a.seconds); return { date, ranked, tie: ranked.length > 1 && ranked[0].seconds === ranked[1].seconds }; });
  const recentDailyTotals = Object.fromEntries(profiles.map((profile) => [profile.id, Object.fromEntries((profile.recentDaily || []).map((day) => [day.date, day.seconds]))]));
  const recentHeadToHead = recentDates.map((date) => {
    const ranked = profiles.map((p) => ({ p, seconds: recentDailyTotals[p.id]?.[date] || 0 })).filter((item) => item.seconds > 0).sort((a, b) => b.seconds - a.seconds);
    return { date, ranked, tie: ranked.length > 1 && ranked[0].seconds === ranked[1].seconds };
  });
  const recentWins = Object.fromEntries(profiles.map((profile) => [profile.id, 0])); let recentTies = 0;
  recentHeadToHead.forEach(({ ranked, tie }) => { if (tie) recentTies += 1; else if (ranked[0]) recentWins[ranked[0].p.id] += 1; });
  const wins = Object.fromEntries(profiles.map((p) => [p.id, 0])); let ties = 0; dayWinners.forEach(({ ranked, tie }) => { if (tie) ties += 1; else if (ranked[0]) wins[ranked[0].p.id] += 1; });
  const commonStreak = (() => { let max = 0; let run = 0; dayWinners.forEach(({ ranked }) => { if (profiles.length && ranked.length === profiles.length) { run += 1; max = Math.max(max, run); } else run = 0; }); return max; })();
  const rivals = [...new Set(profiles.flatMap((p) => p.current.projectBreakdown.map((row) => row.name)))].map((name) => ({ name, totals: profiles.map((p) => p.current.projectBreakdown.find((r) => r.name === name)?.seconds || 0) })).sort((a, b) => Math.max(...b.totals) - Math.max(...a.totals));
  const maxRival = Math.max(1, ...rivals.flatMap((r) => r.totals));
  const colorSlot = (id) => {
    if (Number.isInteger(colorSelections[id]) && colorSelections[id] >= 0 && colorSelections[id] < 12) return colorSelections[id];
    if (id === profileId) return 0;
    const index = connections.findIndex((connection) => connection.id === id);
    return index >= 0 ? (index + 1) % 12 : 0;
  };
  const profileIdsForPalette = [...new Set([profileId, ...connections.map((connection) => connection.id), ...profiles.map((profile) => profile.id)].filter(Boolean))];
  const comparePaletteStyle = Object.fromEntries(profileIdsForPalette.map((id) => [profileColor(id).slice(4, -1), `var(--compare-series-${colorSlot(id)})`]));
  const selectProfileColor = (id, slot) => setColorSelections((current) => {
    const priorSlot = colorSlot(id);
    const assignedTo = profileIdsForPalette.find((otherId) => otherId !== id && colorSlot(otherId) === slot);
    return { ...current, [id]: slot, ...(assignedTo ? { [assignedTo]: priorSlot } : {}) };
  });
  const shareRecap = async () => {
    const you = profiles.find((profile) => profile.id === profileId);
    if (!you) return;
    const values = { time: `Study time: ${duration(you.current.seconds)}`, activeDays: `Active days: ${you.current.activeDays}`, sessions: `Sessions: ${you.current.sessions}`, goal: you.current.goalProgressPct == null ? '' : `Goal progress: ${you.current.goalProgressPct}%`, bestDay: you.current.bestDay ? `Best day: ${duration(you.current.bestDay.seconds)}` : '' };
    const details = shareFields.map((field) => values[field]).filter(Boolean);
    const text = `${you.name}'s ${periodLabel.toLowerCase()} study recap\n${details.join('\n')}`;
    try {
      if (navigator.share) await navigator.share({ title: 'PlotHour study recap', text });
      else { await navigator.clipboard.writeText(text); setShareStatus('Recap copied'); }
      setShareOpen(false);
    } catch (error) {
      if (error?.name !== 'AbortError') setShareStatus('Could not share recap');
    }
  };
  const shareRecapImage = async () => {
    const you = profiles.find((profile) => profile.id === profileId);
    if (!you || !shareFields.length) return;
    const optionValues = { time: ['Study time', duration(you.current.seconds)], activeDays: ['Active days', String(you.current.activeDays)], sessions: ['Sessions', String(you.current.sessions)], goal: ['Goal progress', you.current.goalProgressPct == null ? 'No goal set' : `${you.current.goalProgressPct}%`], bestDay: ['Best day', you.current.bestDay ? duration(you.current.bestDay.seconds) : 'No study days'] };
    try {
      const blob = await createRecapImage({ name: you.name, period: periodLabel, metrics: shareFields.map((field) => optionValues[field]).filter(Boolean) });
      const safeName = you.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'plothour';
      const file = new File([blob], `${safeName}-${range}-study-recap.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({ title: 'PlotHour study recap', files: [file] });
        setShareStatus('Recap image shared');
      } else {
        const imageUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = file.name;
        document.body.append(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(imageUrl), 1000);
        setShareStatus('Recap image downloaded');
      }
      setShareOpen(false);
    } catch (error) {
      if (error?.name !== 'AbortError') setShareStatus('Could not create recap image');
    }
  };

  return <main className="compare-page" aria-label="Study comparison" style={{ ...comparePaletteStyle, ...getSiteFontStyle(config, 'compare') }}>
    <div className="compare-topbar"><div className="compare-range-select" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setRangeOpen(false); }} onKeyDown={(event) => { if (event.key === 'Escape') setRangeOpen(false); }}><div className="compare-control-label"><CalendarDays size={14} /> STUDY PERIOD</div><button className="compare-range-trigger" type="button" aria-haspopup="listbox" aria-expanded={rangeOpen} onClick={() => setRangeOpen((open) => !open)}><span>{RANGE_OPTIONS.find((option) => option.id === range)?.label || 'This week'}</span><ChevronDown size={15} /></button>{rangeOpen && <div className="compare-range-menu" role="listbox" aria-label="Study period">{RANGE_OPTIONS.map((option) => <button type="button" role="option" aria-selected={range === option.id} className={range === option.id ? 'is-selected' : ''} key={option.id} onClick={() => { setRange(option.id); setRangeOpen(false); }}>{option.label}</button>)}</div>}</div><div className="compare-topbar-actions"><button className="compare-manage-button" type="button" onClick={toggleDetails} aria-expanded={showDetails}>{showDetails ? <ChevronUp size={15} /> : <ChevronDown size={15} />} {showDetails ? 'Hide details' : 'More insights'}</button><button className="compare-manage-button" type="button" onClick={() => setShareOpen(true)} disabled={!profiles.some((profile) => profile.id === profileId)}><Share2 size={15} /> {text('compare', 'shareButton', 'Share recap')}</button><button className="compare-manage-button" type="button" onClick={() => setManageViewOpen(true)}><Settings2 size={15} /> Manage view <span>{selectedConnections.length}</span></button></div></div>
    {shareStatus && <p className="compare-share-status" role="status">{shareStatus}</p>}
    {shareOpen && (() => {
      const you = profiles.find((profile) => profile.id === profileId);
      if (!you) return null;
      const options = [['time', 'Study time', duration(you.current.seconds)], ['activeDays', 'Active days', String(you.current.activeDays)], ['sessions', 'Sessions', String(you.current.sessions)], ['goal', 'Goal progress', you.current.goalProgressPct == null ? 'No goal set' : `${you.current.goalProgressPct}%`], ['bestDay', 'Best day', you.current.bestDay ? duration(you.current.bestDay.seconds) : 'No study days']];
      return createPortal(<div className="compare-modal-backdrop" style={comparePaletteStyle} onMouseDown={(event) => { if (event.target === event.currentTarget) setShareOpen(false); }}><section className="compare-share-panel" role="dialog" aria-modal="true" aria-labelledby="compare-share-title">
        <div className="compare-share-heading"><div><span className="compare-eyebrow">STUDY RECAP</span><h2 id="compare-share-title">Choose what to share</h2><p>Only your own summary is included. Preview it before sharing.</p></div><button type="button" aria-label="Close share preview" onClick={() => setShareOpen(false)}>×</button></div>
        <div className="compare-share-options">{options.map(([id, label, value]) => <label key={id}><input type="checkbox" checked={shareFields.includes(id)} onChange={(event) => setShareFields((current) => event.target.checked ? [...current, id] : current.filter((field) => field !== id))} /><span>{label}</span><strong>{value}</strong></label>)}</div>
        <article className="compare-share-preview"><span>{you.name} · {periodLabel}</span>{options.filter(([id]) => shareFields.includes(id)).map(([id, label, value]) => <div key={id}><span>{label}</span><strong>{value}</strong></div>)}</article>
        <div className="compare-share-actions"><button className="compare-manage-button" type="button" onClick={() => setShareOpen(false)}>Cancel</button><button className="compare-manage-button" type="button" disabled={!shareFields.length} onClick={shareRecap}><Share2 size={15} /> {text('compare', 'shareButton', 'Share recap')}</button><button className="compare-manage-button compare-share-image-button" type="button" disabled={!shareFields.length} onClick={shareRecapImage}><ImageIcon size={15} /> Share as image</button></div>
      </section></div>, document.body);
    })()}
    {(() => {
      const you = profiles.find((profile) => profile.id === profileId);
      if (!you) return null;
      const delta = you.current.seconds - you.previous.seconds;
      return <section className="compare-section-card compare-personal-pulse" aria-label="Your progress this period">
        <div><span className="compare-eyebrow">YOUR PROGRESS</span><h2>{periodLabel}</h2><p>{range === 'all' ? 'Your cumulative study summary.' : `${delta > 0 ? `${duration(delta)} more` : delta < 0 ? `${duration(Math.abs(delta))} less` : 'About the same'} study time than the previous comparable period.`}</p></div>
        <div className="compare-pulse-metrics"><span><strong>{duration(you.current.seconds)}</strong>total time</span><span><strong>{you.current.activeDays}</strong>active days</span><span><strong>{you.current.sessions}</strong>sessions</span><span><strong>{you.current.bestDay ? duration(you.current.bestDay.seconds) : '—'}</strong>best day</span></div>
      </section>;
    })()}
    {range === 'custom' && <div className="compare-custom-range"><label>From<input type="date" value={customStart} max={customEnd} onChange={(e) => setCustomStart(e.target.value)} /></label><label>To<input type="date" value={customEnd} min={customStart} max={dateKey(new Date())} onChange={(e) => setCustomEnd(e.target.value)} /></label></div>}

    {manageViewOpen && createPortal(<div className="compare-modal-backdrop" style={comparePaletteStyle} onMouseDown={(e) => { if (e.target === e.currentTarget) setManageViewOpen(false); }}><section className="compare-manage-panel" role="dialog" aria-modal="true" aria-labelledby="compare-manage-heading"><div className="compare-manage-panel-heading"><div><span className="compare-eyebrow">COMPARE VIEW</span><h2 id="compare-manage-heading">Choose profiles</h2><p>Select the connected people to include in your comparison.</p></div><button type="button" aria-label="Close manage view" onClick={() => setManageViewOpen(false)}>×</button></div>
      {!user?.id && !demoMode ? <div className="compare-empty compact"><strong>Sign in to compare account data</strong><span>Comparison uses saved account sessions and connected profiles. Demo history is not used.</span></div> : connectionError ? <p className="compare-inline-error" role="alert">{connectionError}</p> : <div className="compare-manage-list">
        <div className="compare-manage-person is-you"><span className="compare-manage-name"><i className="compare-person-dot" style={{ '--profile-color': profileColor(profileId) }} /><span><strong>{demoMode ? readJson('studyduel_demo_preferences', {}).displayName || 'Alex Morgan' : user.display_name || user.email?.split('@')[0] || 'You'}</strong><small>{demoMode ? 'Demo account · always included' : 'Your account · always included'}</small></span></span><ColorChooser id={profileId} selected={colorSlot(profileId)} onSelect={selectProfileColor} paletteStyle={comparePaletteStyle} /><button type="button" className="compare-profile-toggle" role="checkbox" aria-label="Your account is always included" aria-checked="true" disabled><Check size={14} strokeWidth={3} aria-hidden="true" /></button></div>
        {connections.map((connection) => <div className="compare-manage-person" key={connection.id}><span className="compare-manage-name"><i className="compare-person-dot" style={{ '--profile-color': profileColor(connection.id) }} /><span><strong>{connection.name}</strong><small>{connection.email || 'Study partner'}</small></span></span><ColorChooser id={connection.id} selected={colorSlot(connection.id)} onSelect={selectProfileColor} paletteStyle={comparePaletteStyle} /><button type="button" className="compare-profile-toggle" role="checkbox" aria-label={`Include ${connection.name} in comparison`} aria-checked={selectedIds.includes(connection.id)} onClick={() => toggle(connection.id)}><Check size={14} strokeWidth={3} aria-hidden="true" /></button></div>)}
        {!connections.length && <div className="compare-empty compact"><strong>No connected profiles yet</strong><span>Connect study partners in Settings to make them available here.</span>{!demoMode && <button type="button" className="compare-manage-button" onClick={() => { setManageViewOpen(false); try { localStorage.setItem('studyduel_settings_tab', 'connections'); } catch {} onNavigate?.('settings'); }}>Manage connections</button>}</div>}
      </div>}
      <div className="compare-manage-panel-footer"><span>{selectedConnections.length} {demoMode ? 'sample ' : ''}connected {selectedConnections.length === 1 ? 'profile' : 'profiles'} selected</span><button type="button" onClick={() => setManageViewOpen(false)}>Done</button></div></section></div>, document.body)}

    {(connectionError || dataError) && <p className="compare-inline-error" role="alert">{connectionError || dataError}</p>}
    <section className="compare-section-card" aria-labelledby="standings-title"><Heading eyebrow={text('compare', 'periodLabel', 'PERIOD STANDINGS')} title={text('compare', 'periodTitle', 'Period standings')} detail={`${profiles.length} ${profiles.length === 1 ? 'profile' : 'profiles'} · ${periodDescription} · study time`} loading={loading} />
      {!profiles.length ? <Empty user={user} demoMode={demoMode} onManage={() => setManageViewOpen(true)} /> : <><div className="compare-leader-layout"><div className="compare-leader-card" style={{ '--profile-color': profileColor(ordered[0].id) }}><span>STUDY TIME LEADER</span><div><strong>{ordered[0].name}</strong><b>{duration(ordered[0].current.seconds)}</b></div><small>{ordered.length === 1 ? 'Your study time in this period.' : `Leads by ${duration(ordered[0].current.seconds - ordered[1].current.seconds)}.`} · {periodLabel} · {periodDescription}</small></div><div className="compare-leader-bars">{ordered.map((p, i) => <div className="compare-leader-bar-row" key={p.id}><span>{String(i + 1).padStart(2, '0')}</span><strong>{p.name}</strong><div><i style={{ width: `${ordered[0].current.seconds ? p.current.seconds / ordered[0].current.seconds * 100 : 0}%`, '--profile-color': profileColor(p.id) }} /></div><b>{duration(p.current.seconds)}</b></div>)}</div></div><div className="compare-table-scroll"><table className="compare-standings-table"><thead><tr><th>#</th><th>Profile</th><th>Study time</th><th>Change vs previous</th><th>Active days</th><th>Sessions</th><th>Avg / active day</th></tr></thead><tbody>{ordered.map((p, i) => <tr key={p.id}><td>{String(i + 1).padStart(2, '0')}</td><th scope="row"><i style={{ '--profile-color': profileColor(p.id) }} />{p.name}{p.id === profileId && <small>You</small>}</th><td>{duration(p.current.seconds)}</td><td className="compare-delta">{change(p)}</td><td>{p.current.activeDays}</td><td>{p.current.sessions}</td><td>{duration(p.current.averageActiveDaySeconds, '—')}</td></tr>)}</tbody></table></div></>}
    </section>

    <section className="compare-section-card"><div className="compare-section-heading"><div><span className="compare-eyebrow">STUDY TIME BY WEEK</span><h2>{text('compare', 'studyTimeByWeek', 'Study time by week')}</h2><p>Weekly totals within the selected study period · latest 12 weeks shown</p></div><Legend profiles={profiles} /></div>{!profiles.length ? <div className="compare-empty compact">No account data to display.</div> : <div className="compare-weekly-chart">{weeks.map((w) => { const sum = Object.values(w.totals).reduce((a, b) => a + b, 0); return <div className="compare-week-row" key={w.key}><span className="compare-week-label">{prettyDate(w.key)}</span><div className="compare-week-details"><div className="compare-week-track">{profiles.map((p, i) => { const v = w.totals[p.id] || 0; return v ? <i key={p.id} style={{ width: `${v / maxWeek * 100}%`, '--profile-color': profileColor(p.id) }} /> : null; })}</div><div className="compare-week-breakdown">{profiles.map((p, i) => <span key={p.id} style={{ '--profile-color': profileColor(p.id) }}><i />{p.name}: {duration(w.totals[p.id] || 0)}</span>)}</div></div><strong>{duration(sum)}</strong></div>; })}</div>}</section>

    <section className="compare-section-card"><div className="compare-section-heading"><div><span className="compare-eyebrow">STUDY PATTERNS</span><h2>Study patterns</h2><p>{periodDescription} · compare patterns across selected profiles</p></div></div>{!profiles.length ? <div className="compare-empty compact">No account data to display.</div> : <div className="compare-pattern-grid">{ordered.map((p) => <article className="compare-pattern-card" key={p.id} style={{ '--profile-color': profileColor(p.id) }}><div className="compare-pattern-heading"><span><i />{p.name}{p.id === profileId && <small>You</small>}</span><strong>{duration(p.current.seconds)}</strong></div><PatternMetrics profile={p} /></article>)}</div>}</section>

    {profiles.length > 0 && <>
      {showDetails && <section className="compare-section-card compare-fairness-note"><Info size={16} /><p>Study time is easiest to compare alongside active days and average time per active day. Different goals and schedules can make totals tell only part of the story.</p></section>}
      {showDetails && <>
      <DailyCharts profiles={profiles} dates={series.dates} byProfile={series.byProfile} />
      <div className="compare-chart-pair">
        <section className="compare-section-card"><div className="compare-section-heading"><div><span className="compare-eyebrow">GOAL PACE RACE</span><h2>Goal pace race</h2><p>Study time against the combined project goals</p></div></div>{!raceProfiles.length ? <div className="compare-empty compact">No study goals are set for this period.</div> : <div className="compare-goal-list">{raceProfiles.map((p) => <div className="compare-goal-row" key={p.id} style={{ '--profile-color': profileColor(p.id) }}><div><strong>{p.name}</strong><span>{duration(p.current.seconds)} / {duration(p.current.goalSeconds)} goal</span></div><div className="compare-goal-track"><i style={{ width: `${Math.min(100, p.current.goalProgressPct || 0)}%` }} /></div><small>{p.current.goalProgressPct}% of goal</small></div>)}</div>}</section>
        <section className="compare-section-card"><div className="compare-section-heading"><div><span className="compare-eyebrow">PERIOD HEAD-TO-HEAD</span><h2>Day-by-day results</h2><p>Latest 7 days, including today</p></div></div><div className="compare-table-scroll"><table className="compare-standings-table compare-head-to-head"><thead><tr><th>Day</th>{profiles.map((p) => <th key={p.id} style={{ color: profileColor(p.id) }}>{p.name}</th>)}<th>Result</th></tr></thead><tbody>{recentHeadToHead.map(({ date, ranked, tie }) => <tr key={date}><td>{prettyDate(date)}</td>{profiles.map((p) => <td key={p.id}>{duration(recentDailyTotals[p.id]?.[date] || 0)}</td>)}<td>{tie ? <span className="compare-h2h-tie">Tie</span> : ranked[0] ? <strong className="compare-h2h-winner" style={{ color: profileColor(ranked[0].p.id) }}>{ranked[0].p.name}</strong> : <span className="compare-h2h-tie">—</span>}</td></tr>)}</tbody></table></div><p className="compare-footnote">{Object.values(recentWins).reduce((sum, value) => sum + value, 0)} day wins · {recentTies} ties · last 7 days</p></section>
      </div>
      <div className="compare-chart-pair">
        <section className="compare-section-card"><div className="compare-section-heading"><div><span className="compare-eyebrow">STUDY-DAY STREAKS</span><h2>Streaks and consistency</h2><p>Longest consecutive run and current period streak</p></div></div><div className="compare-record-list">{ordered.map((p) => <div key={p.id} style={{ '--profile-color': profileColor(p.id) }}><span><i />{p.name}</span><strong>{p.current.longestStreak} days</strong><small>Longest run · {p.current.streakAtEnd} days at period end</small></div>)}</div><p className="compare-footnote">Longest shared streak across {profiles.length} {profiles.length === 1 ? 'profile' : 'profiles'}: {commonStreak} {commonStreak === 1 ? 'day' : 'days'}.</p></section>
        <section className="compare-section-card"><div className="compare-section-heading"><div><span className="compare-eyebrow">PERSONAL RECORDS</span><h2>Personal records</h2><p>Best day and longest session in this period</p></div></div><div className="compare-record-grid">{ordered.map((p) => <article key={p.id} style={{ '--profile-color': profileColor(p.id) }}><strong><i />{p.name}</strong><span>Best day</span><b>{p.current.bestDay ? `${duration(p.current.bestDay.seconds)} · ${prettyDate(p.current.bestDay.date)}` : 'No study days yet'}</b><span>Longest session</span><b>{p.current.longestSession ? `${duration(p.current.longestSession.seconds)} · ${prettyDate(p.current.longestSession.date)}` : 'No sessions yet'}</b></article>)}</div></section>
      </div>
      <div className="compare-chart-pair">
        <section className="compare-section-card"><div className="compare-section-heading"><div><span className="compare-eyebrow">PROJECT RIVALRY</span><h2>Project rivalry</h2><p>Compare time by project or subject saved with each study session</p></div><Legend profiles={profiles} /></div>{!rivals.length ? <div className="compare-empty compact">Session records do not include project or subject names for this period.</div> : <div className="compare-rival-list">{rivals.slice(0, 12).map((r) => <div key={r.name}><span>{r.name}</span><div>{r.totals.map((v, i) => <i key={profiles[i].id} title={`${profiles[i].name}: ${duration(v)}`} style={{ width: `${v / maxRival * 100}%`, '--profile-color': profileColor(profiles[i].id) }} />)}</div><strong>{duration(Math.max(...r.totals))}</strong></div>)}</div>}</section>
        <section className="compare-section-card"><div className="compare-section-heading"><div><span className="compare-eyebrow">PERIOD WINS</span><h2>Wins by study time</h2><p>Days with the most recorded study time</p></div><Legend profiles={profiles} /></div><div className="compare-wins-list">{ordered.map((p) => <div key={p.id} style={{ '--profile-color': profileColor(p.id) }}><span><i />{p.name}</span><div><i style={{ width: `${allDates.length ? wins[p.id] / allDates.length * 100 : 0}%` }} /></div><strong>{wins[p.id]}</strong></div>)}</div><p className="compare-footnote">{ties} tied {ties === 1 ? 'day' : 'days'}.</p></section>
      </div>
      <section className="compare-section-card"><div className="compare-section-heading"><div><span className="compare-eyebrow">STREAK & CONSISTENCY</span><h2>Consistency comparison</h2><p>Session and streak metrics from the selected period</p></div></div><div className="compare-table-scroll"><table className="compare-standings-table compare-consistency-table"><thead><tr><th>Metric</th>{profiles.map((p, i) => <th key={p.id} style={{ color: profileColor(p.id) }}>{p.name}</th>)}</tr></thead><tbody>{[
        ['Streak at period end', (p) => `${p.current.streakAtEnd} days`], ['Longest streak', (p) => `${p.current.longestStreak} days`], ['Average per active day', (p) => duration(p.current.averageActiveDaySeconds, '—')], ['Average session', (p) => duration(p.current.averageSessionSeconds, '—')], ['Longest session', (p) => duration(p.current.longestSession?.seconds, '—')], ['Peak study hour', (p) => p.current.peakHour == null ? '—' : new Date(2000, 0, 1, p.current.peakHour).toLocaleTimeString(undefined, { hour: 'numeric' })],
      ].map(([label, value]) => <tr key={label}><th scope="row" title={metricHelp[label] || label}>{label}<Info size={12} aria-hidden="true" /></th>{profiles.map((p) => <td key={p.id}>{value(p)}</td>)}</tr>)}</tbody></table></div></section>
      </>}
    </>}
  </main>;
};

function Heading({ eyebrow, title, detail, loading }) { return <div className="compare-section-heading"><div><span className="compare-eyebrow">{eyebrow}</span><h2>{title}</h2><p>{detail}</p></div>{loading && <span className="compare-loading"><LoaderCircle size={15} className="compare-spin" /> Updating</span>}</div>; }
function Empty({ user, demoMode, onManage }) { return <div className="compare-empty"><Users size={22} /><strong>{user?.id || demoMode ? 'Choose a connected profile to compare' : 'Sign in to compare account data'}</strong><span>{user?.id || demoMode ? 'Your profile is included automatically. Use Manage view to choose study partners.' : 'Comparison requires your saved account sessions. Sign in to load your account and connected profiles.'}</span>{(user?.id || demoMode) && <button type="button" className="compare-manage-button" onClick={onManage}>Manage view</button>}</div>; }
function ColorChooser({ id, selected, onSelect, paletteStyle }) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState(null);
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const triggerRef = useRef(null);
  const updateMenuPosition = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const menuWidth = 158;
    const menuHeight = 62;
    const top = rect.bottom + menuHeight + 7 > window.innerHeight - 8
      ? Math.max(8, rect.top - menuHeight - 7)
      : Math.min(rect.bottom + 7, window.innerHeight - menuHeight - 8);
    setMenuPosition({ top, left: Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8)) });
  };
  useEffect(() => {
    if (!open) return undefined;
    updateMenuPosition();
    const closeOnOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [open]);
  return <div ref={rootRef} className="compare-color-chooser" role="group" aria-label={`Color for profile ${id}`}>
    <button ref={triggerRef} type="button" className="compare-color-trigger" style={{ '--profile-color': `var(--compare-series-${selected})` }} aria-label={`Change profile color for ${id}`} aria-haspopup="true" aria-expanded={open} onClick={() => { if (open) setOpen(false); else { updateMenuPosition(); setOpen(true); } }} />
    {open && menuPosition && createPortal(<div ref={menuRef} className="compare-color-options" style={{ ...paletteStyle, ...menuPosition }} role="group" aria-label={`Choose profile color for ${id}`}>
      {Array.from({ length: 12 }, (_, slot) => <button key={slot} type="button" className={selected === slot ? 'is-selected' : ''} style={{ '--profile-color': `var(--compare-series-${slot})` }} aria-label={`Color ${slot + 1}`} aria-pressed={selected === slot} onClick={() => { onSelect(id, slot); setOpen(false); }} />)}
    </div>, document.body)}
  </div>;
}
