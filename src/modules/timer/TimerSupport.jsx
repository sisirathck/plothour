import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

/* ── Storage Keys ───────────────────────────── */
export const K_PROJECTS = 'studyduel_demo_projects';
export const K_ACTIVE = 'studyduel_demo_active_timer';
export const K_ENTRIES = 'studyduel_demo_time_entries';

export const rj = (key, fallback) => {
  try {
    const v = JSON.parse(localStorage.getItem(key) || 'null');
    return v ?? fallback;
  } catch {
    return fallback;
  }
};
export const readTimerPreferences = (key) => {
  const saved = rj(key, {});
  const isLegacyDefault = !saved.timerDefaultModeVersion && saved.defaultTimerMode === '50m';
  return {
    ...saved,
    defaultTimerMode: isLegacyDefault ? 'stopwatch' : saved.defaultTimerMode || 'stopwatch',
    timerDefaultModeVersion: 2,
    soundEnabled: saved.soundEnabled ?? true,
  };
};

const pad = (n) => String(Math.floor(n)).padStart(2, '0');
export const fmtClock = (s) => `${pad(s / 3600)}:${pad((s % 3600) / 60)}:${pad(s % 60)}`;
export const fmtDur = (s) => {
  if (!s || s <= 0) return '0m';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};
const WEEKS_PER_MONTH = 365.25 / 7 / 12;
const STUDY_DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const getSubjectStudySchedule = (subject) => {
  const goals = subject?.goals || {};
  const dailyGoalHours = Number(goals.daily) || 0;
  const weeklyGoalHours = Number(goals.weekly) || 0;
  const monthlyGoalHours = Number(goals.monthly) || 0;
  const configuredDays = Array.isArray(subject?.studyDays)
    ? subject.studyDays.filter((value) => Number.isInteger(value) && value >= 0 && value <= 6)
    : [];
  const studyDays = configuredDays.length
    ? configuredDays
    : dailyGoalHours > 0 || weeklyGoalHours > 0 || monthlyGoalHours > 0 ? ALL_STUDY_DAYS : [];
  const basis = ['daily', 'weekly', 'monthly'].includes(goals.basis)
    ? goals.basis
    : dailyGoalHours > 0 ? 'daily' : weeklyGoalHours > 0 ? 'weekly' : 'monthly';
  const dayCount = studyDays.length || ALL_STUDY_DAYS.length;
  const targetHours = basis === 'daily'
    ? dailyGoalHours
    : basis === 'weekly'
      ? weeklyGoalHours / dayCount
      : monthlyGoalHours / WEEKS_PER_MONTH / dayCount;
  const goalDaysLabel = studyDays.map((day) => STUDY_DAY_LABELS[day]).join(', ');
  return { studyDays, targetHours, goalBasis: basis, goalDaysLabel };
};
export const TIMER_GOALS = [
  { id: '25m', label: '25 min', seconds: 25 * 60 },
  { id: '50m', label: '50 min', seconds: 50 * 60 },
  { id: 'stopwatch', label: 'Open', seconds: 0 },
];
const ALL_STUDY_DAYS = [0, 1, 2, 3, 4, 5, 6];

/* ── Default Sample Projects ───────────────── */
export const DEFAULT_PROJECTS = [
  {
    id: 'cs',
    name: 'Computer Science',
    color: '#f3957f',
    subjects: [
      { id: 'algo', name: 'Algorithms', color: '#f3957f' },
      { id: 'ds', name: 'Data Structures', color: '#e07a5f' },
      { id: 'sys', name: 'System Design', color: '#f4a261' },
    ],
  },
  {
    id: 'math',
    name: 'Mathematics',
    color: '#818cf8',
    subjects: [
      { id: 'calc', name: 'Calculus III', color: '#818cf8' },
      { id: 'lin', name: 'Linear Algebra', color: '#6366f1' },
    ],
  },
  {
    id: 'lang',
    name: 'Languages',
    color: '#34d399',
    subjects: [
      { id: 'jp', name: 'Japanese', color: '#34d399' },
      { id: 'de', name: 'German', color: '#10b981' },
    ],
  },
];

/* ── Custom Select Component ───────────────── */
export const CustomSelect = ({ value, onChange, options, placeholder, disabled, accentValue = false }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    const fn = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  return (
    <div ref={rootRef} className={`t-select${open ? ' open' : ''}${disabled ? ' disabled' : ''}${accentValue ? ' t-select-subject' : ''}`}>
      <button
        type="button"
        className="t-select-btn"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
      >
        <span className="t-sel-text">{selected ? selected.label : placeholder}</span>
        <ChevronDown size={14} className="t-sel-chevron" />
      </button>
      {open && (
        <div className="t-select-menu">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              className={`t-select-opt${o.value === value ? ' sel' : ''}`}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              <span className="t-opt-label">{o.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/* ── Main Timer Page ───────────────────────── */

