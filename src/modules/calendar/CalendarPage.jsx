import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, X } from 'lucide-react';
import { TimerEntriesList } from '../timer/TimerEntriesList';
import './CalendarPage.css';

const readLocalValue = (key, fallback) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || 'null');
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const entryDateKey = (value) => dateKey(new Date(value));
const formatDuration = (seconds) => {
  const minutes = Math.floor(Math.max(0, seconds) / 60);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours && remainder) return `${hours}h ${remainder}m`;
  if (hours) return `${hours}h`;
  return minutes ? `${minutes}m` : '—';
};

export const CalendarPage = ({ user, entries: providedEntries, setEntries: setProvidedEntries, projects: providedProjects, onClose }) => {
  const entriesKey = user?.id ? `studyduel_user_${user.id}_time_entries` : 'studyduel_demo_time_entries';
  const projectsKey = user?.id ? `studyduel_user_${user.id}_projects` : 'studyduel_demo_projects';
  const [localEntries, setLocalEntries] = useState(() => readLocalValue(entriesKey, []));
  const [localProjects, setLocalProjects] = useState(() => readLocalValue(projectsKey, []));
  const entries = providedEntries ?? localEntries;
  const setEntries = setProvidedEntries ?? setLocalEntries;
  const projects = providedProjects ?? localProjects;
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => new Date());

  useEffect(() => {
    if (!onClose) return undefined;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    const sync = (event) => {
      if (event?.key && event.key !== entriesKey && event.key !== projectsKey) return;
      if (!providedEntries) setLocalEntries(readLocalValue(entriesKey, []));
      if (!providedProjects) setLocalProjects(readLocalValue(projectsKey, []));
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [entriesKey, projectsKey, providedEntries, providedProjects]);

  useEffect(() => {
    if (providedEntries) return;
    localStorage.setItem(entriesKey, JSON.stringify(entries));
    const detail = {
      entriesKey,
      activeTimerKey: user?.id ? `studyduel_user_${user.id}_active_timer` : 'studyduel_demo_active_timer',
    };
    try {
      const openerWindow = window.opener;
      if (openerWindow && !openerWindow.closed) {
        openerWindow.dispatchEvent(new openerWindow.CustomEvent('studyduel:timer-storage', { detail }));
      }
    } catch { /* The popup may have been opened without an accessible opener. */ }
  }, [entries, entriesKey, providedEntries, user?.id]);

  const totalsByDay = useMemo(() => entries.reduce((totals, entry) => {
    const key = entryDateKey(entry.startedAt);
    totals[key] = (totals[key] || 0) + (Number(entry.durationSeconds) || 0);
    return totals;
  }, {}), [entries]);

  const monthCells = useMemo(() => {
    const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
    const offset = first.getDay();
    const count = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
    const cellCount = Math.ceil((offset + count) / 7) * 7;
    return Array.from({ length: cellCount }, (_, index) => {
      const day = index - offset + 1;
      return day < 1 || day > count ? null : new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
    });
  }, [viewMonth]);

  const monthSeconds = monthCells.reduce((sum, day) => sum + (day ? totalsByDay[dateKey(day)] || 0 : 0), 0);
  const monthSessions = entries.filter((entry) => {
    const date = new Date(entry.startedAt);
    return date.getFullYear() === viewMonth.getFullYear() && date.getMonth() === viewMonth.getMonth();
  }).length;
  const selectedKey = dateKey(selectedDate);
  const maxDaySeconds = Math.max(1, ...monthCells.map((day) => day ? totalsByDay[dateKey(day)] || 0 : 0));
  const changeMonth = (delta) => {
    const next = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + delta, 1);
    setViewMonth(next);
    setSelectedDate(new Date(next.getFullYear(), next.getMonth(), 1));
  };

  const calendarContent = (
    <div className="calendar-page">
      <header className="calendar-page-heading">
        <div>
          <span className="calendar-eyebrow"><CalendarDays size={14} /> STUDY CALENDAR</span>
          <h1>Study calendar</h1>
          <p>Your study sessions, day by day.</p>
        </div>
      </header>

      <section className="calendar-month-card" aria-label="Monthly study calendar">
        <div className="calendar-month-toolbar">
          <div className="calendar-month-title">
            <h2>{viewMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
            <span><Clock3 size={14} /> {formatDuration(monthSeconds)} · {monthSessions} {monthSessions === 1 ? 'session' : 'sessions'}</span>
          </div>
          <div className="calendar-month-actions">
            <button type="button" className="calendar-today-btn" onClick={() => {
              const today = new Date();
              setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1));
              setSelectedDate(today);
            }}>Today</button>
            <button type="button" className="calendar-nav-btn" aria-label="Previous month" onClick={() => changeMonth(-1)}><ChevronLeft size={18} /></button>
            <button type="button" className="calendar-nav-btn" aria-label="Next month" onClick={() => changeMonth(1)}><ChevronRight size={18} /></button>
          </div>
        </div>

        <div className="calendar-weekdays" aria-hidden="true">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}
        </div>
        <div className="calendar-month-grid">
          {monthCells.map((day, index) => {
            if (!day) return <span className="calendar-day-empty" key={`empty-${index}`} aria-hidden="true" />;
            const key = dateKey(day);
            const seconds = totalsByDay[key] || 0;
            const intensity = seconds === 0 ? 0 : Math.min(4, Math.max(1, Math.ceil((seconds / maxDaySeconds) * 4)));
            const today = key === dateKey(new Date());
            return (
              <button
                key={key}
                type="button"
                className={`calendar-day-cell heat-${intensity}${selectedKey === key ? ' selected' : ''}${today ? ' today' : ''}`}
                onClick={() => setSelectedDate(day)}
                aria-pressed={selectedKey === key}
                aria-label={`${day.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}: ${formatDuration(seconds)} study`}
                title={`${day.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })} · ${formatDuration(seconds)}`}
              >
                <span className="calendar-day-number">{day.getDate()}</span>
                <span className="calendar-day-total">{formatDuration(seconds)}</span>
                {seconds > 0 && <span className="calendar-day-mark" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
        <div className="calendar-heat-legend"><span>Less</span><i className="heat-0" /><i className="heat-1" /><i className="heat-2" /><i className="heat-3" /><i className="heat-4" /><span>More study</span></div>
      </section>

      <section className="calendar-entries-section" aria-label="Selected day sessions">
        <div className="calendar-entries-heading">
          <div>
            <span className="calendar-eyebrow">DAY ENTRIES</span>
            <h2>{selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
          </div>
          <span className="calendar-selected-total">{formatDuration(totalsByDay[selectedKey] || 0)} studied</span>
        </div>
        <TimerEntriesList entries={entries} setEntries={setEntries} projects={projects} selectedDate={selectedDate} hideRangeControls />
      </section>
    </div>
  );

  if (!onClose) return calendarContent;
  return (
    <div className="calendar-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="calendar-modal-dialog" role="dialog" aria-modal="true" aria-label="Study calendar">
        <div className="calendar-modal-topbar">
          <span><CalendarDays size={15} /> Study calendar</span>
          <button type="button" className="calendar-modal-close" onClick={onClose} aria-label="Close calendar"><X size={18} /></button>
        </div>
        <div className="calendar-modal-scroll">{calendarContent}</div>
      </section>
    </div>
  );
};
