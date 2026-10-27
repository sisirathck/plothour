import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Check, Clock3, X } from 'lucide-react';
import { TimerEntriesList } from '../timer/TimerEntriesList';
import { formatDisplayDate } from '../../utils/dateFormat';
import { getSiteFontStyle, useSiteCustomization } from '../../context/SiteCustomizationContext';
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
  if (!(Number(seconds) > 0)) return '0m';
  const minutes = Math.floor(Math.max(0, seconds) / 60);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours && !minutes) return '<1m';
  if (hours && remainder) return `${hours}h ${remainder}m`;
  if (hours) return `${hours}h`;
  return minutes ? `${minutes}m` : '—';
};
const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKS_PER_MONTH = 365.25 / 7 / 12;

export const CalendarPage = ({ user, entries: providedEntries, setEntries: setProvidedEntries, projects: providedProjects, onClose }) => {
  const { config } = useSiteCustomization();
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
  const [calendarView, setCalendarView] = useState('month');
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [projectFilter, setProjectFilter] = useState('all');
  const [projectFilterOpen, setProjectFilterOpen] = useState(false);
  const projectFilterRef = useRef(null);
  useEffect(() => {
    if (!projectFilterOpen) return undefined;
    const closeOnOutsideClick = (event) => { if (!projectFilterRef.current?.contains(event.target)) setProjectFilterOpen(false); };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, [projectFilterOpen]);
  const [jumpDate, setJumpDate] = useState(dateKey(new Date()));

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

  const filteredEntries = useMemo(() => entries.filter((entry) => {
    if (projectFilter === 'all') return true;
    const [kind, id] = projectFilter.split(':');
    if (kind === 'project') return entry.projectId === id || (!entry.projectId && entry.projectName === projects.find((project) => project.id === id)?.name);
    const subject = projects.flatMap((project) => project.subjects || []).find((item) => item.id === id);
    return entry.subjectId === id || (!entry.subjectId && entry.subjectName === subject?.name);
  }), [entries, projectFilter, projects]);
  const totalsByDay = useMemo(() => filteredEntries.reduce((totals, entry) => {
    const key = entryDateKey(entry.startedAt);
    totals[key] = (totals[key] || 0) + (Number(entry.durationSeconds) || 0);
    return totals;
  }, {}), [filteredEntries]);

  const plannedByDay = useMemo(() => {
    const scheduled = {};
    projects.filter((project) => !project.archived).forEach((project) => {
      (project.subjects || []).forEach((subject) => {
        const goals = subject.goals || {};
        const daily = Number(goals.daily) || 0;
        const weekly = Number(goals.weekly) || 0;
        const monthly = Number(goals.monthly) || 0;
        const days = Array.isArray(subject.studyDays)
          ? subject.studyDays.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
          : [];
        const studyDays = days.length ? days : (daily || weekly || monthly) ? [0, 1, 2, 3, 4, 5, 6] : [];
        const dayCount = studyDays.length || 7;
        const basis = ['daily', 'weekly', 'monthly'].includes(goals.basis)
          ? goals.basis
          : daily > 0 ? 'daily' : weekly > 0 ? 'weekly' : 'monthly';
        const targetHours = basis === 'daily' ? daily : basis === 'weekly' ? weekly / dayCount : monthly / WEEKS_PER_MONTH / dayCount;
        if (!targetHours || !studyDays.length) return;
        if (projectFilter !== 'all') {
          const [kind, id] = projectFilter.split(':');
          if (kind === 'project' && project.id !== id) return;
          if (kind === 'subject' && subject.id !== id) return;
        }
        studyDays.forEach((weekday) => {
          (scheduled[weekday] ||= []).push({
            id: `${project.id}:${subject.id}`,
            project: project.name,
            subject: subject.name,
            color: subject.color || project.color || '#7c83d0',
            targetSeconds: targetHours * 3600,
          });
        });
      });
    });
    Object.values(scheduled).forEach((items) => items.sort((a, b) => a.project.localeCompare(b.project) || a.subject.localeCompare(b.subject)));
    return scheduled;
  }, [projects, projectFilter]);

  const monthCells = useMemo(() => {
    const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
    const offset = first.getDay();
    // Render only the rows this month needs. A fixed six-week grid leaves an
    // entire empty row on most months, which makes the calendar feel sparse.
    const cellCount = Math.ceil((offset + new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate()) / 7) * 7;
    const gridStart = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1 - offset);
    return Array.from({ length: cellCount }, (_, index) => new Date(
      gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index,
    ));
  }, [viewMonth]);

  const isInViewMonth = (day) => day.getFullYear() === viewMonth.getFullYear() && day.getMonth() === viewMonth.getMonth();
  const firstWeekDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() - selectedDate.getDay());
  const weekCells = Array.from({ length: 7 }, (_, index) => new Date(firstWeekDay.getFullYear(), firstWeekDay.getMonth(), firstWeekDay.getDate() + index));
  const visibleDays = calendarView === 'week' ? weekCells : monthCells.filter(isInViewMonth);
  const periodSeconds = visibleDays.reduce((sum, day) => sum + (totalsByDay[dateKey(day)] || 0), 0);
  const periodSessions = filteredEntries.filter((entry) => visibleDays.some((day) => dateKey(day) === entryDateKey(entry.startedAt))).length;
  const selectedKey = dateKey(selectedDate);
  const projectFilterLabel = projectFilter === 'all' ? 'All study areas' : (() => {
    const [kind, id] = projectFilter.split(':');
    if (kind === 'project') return projects.find((project) => project.id === id)?.name || 'All study areas';
    return projects.flatMap((project) => project.subjects || []).find((subject) => subject.id === id)?.name || 'All study areas';
  })();
  const changeMonth = (delta) => {
    if (calendarView === 'week') {
      const nextDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() + delta * 7);
      setSelectedDate(nextDate);
      setViewMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
      setJumpDate(dateKey(nextDate));
      return;
    }
    const next = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + delta, 1);
    setViewMonth(next);
    setSelectedDate(new Date(next.getFullYear(), next.getMonth(), 1));
    setJumpDate(dateKey(new Date(next.getFullYear(), next.getMonth(), 1)));
  };

  const calendarToolbar = (
    <div className={`calendar-month-toolbar${onClose ? ' calendar-month-toolbar--modal' : ''}`}>
      <div className="calendar-month-title">
        <h2>{calendarView === 'week'
          ? `${formatDisplayDate(weekCells[0], { month: 'short', day: 'numeric' })} – ${formatDisplayDate(weekCells[6], { month: 'short', day: 'numeric', year: 'numeric' })}`
          : viewMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
        <div className="calendar-month-metrics" aria-label={`${formatDuration(periodSeconds)} studied across ${periodSessions} sessions`}>
          <span><Clock3 size={13} /> {formatDuration(periodSeconds)}</span>
          <span>{periodSessions} {periodSessions === 1 ? 'session' : 'sessions'}</span>
        </div>
      </div>
      <div className="calendar-month-actions">
        <div className="calendar-command-controls">
          <label className="calendar-view-select" aria-label="Calendar view">
            <select value={calendarView} onChange={(event) => setCalendarView(event.target.value)}>
              <option value="month">Month</option>
              <option value="week">Week</option>
            </select>
            <ChevronDown size={14} aria-hidden="true" />
          </label>
          <div className="calendar-filter-field calendar-filter-select" ref={projectFilterRef} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setProjectFilterOpen(false); }} onKeyDown={(event) => { if (event.key === 'Escape') setProjectFilterOpen(false); }}>
            <button type="button" className="calendar-filter-trigger" aria-label="Filter calendar by project or subproject" aria-haspopup="listbox" aria-expanded={projectFilterOpen} onClick={() => setProjectFilterOpen((open) => !open)}><span>{projectFilterLabel}</span><ChevronDown size={14} aria-hidden="true" /></button>
            {projectFilterOpen && <div className="calendar-filter-menu" role="listbox" aria-label="Study areas">
              <button type="button" role="option" aria-selected={projectFilter === 'all'} onClick={() => { setProjectFilter('all'); setProjectFilterOpen(false); }}><span>All study areas</span>{projectFilter === 'all' && <Check size={15} />}</button>
              {projects.map((project) => <div className="calendar-filter-group" key={project.id}><span>{project.name}</span><button type="button" role="option" aria-selected={projectFilter === `project:${project.id}`} onClick={() => { setProjectFilter(`project:${project.id}`); setProjectFilterOpen(false); }}><span>{project.name}</span>{projectFilter === `project:${project.id}` && <Check size={15} />}</button>{(project.subjects || []).map((subject) => <button className="is-nested" type="button" role="option" aria-selected={projectFilter === `subject:${subject.id}`} key={subject.id} onClick={() => { setProjectFilter(`subject:${subject.id}`); setProjectFilterOpen(false); }}><span>{subject.name}</span>{projectFilter === `subject:${subject.id}` && <Check size={15} />}</button>)}</div>)}
            </div>}
          </div>
          <label className="calendar-jump-control" aria-label="Jump to date">
            <CalendarDays size={14} aria-hidden="true" />
            <input aria-label="Jump to date" type="date" value={jumpDate} onChange={(event) => { const value = event.target.value; setJumpDate(value); if (!value) return; const date = new Date(`${value}T12:00:00`); if (Number.isFinite(date.getTime())) { setViewMonth(new Date(date.getFullYear(), date.getMonth(), 1)); setSelectedDate(date); } }} />
          </label>
        </div>
        <button type="button" className="calendar-today-btn" onClick={() => {
          const today = new Date();
          setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1));
          setSelectedDate(today);
          setJumpDate(dateKey(today));
        }}>Today</button>
        <button type="button" className="calendar-nav-btn" aria-label="Previous month" onClick={() => changeMonth(-1)}><ChevronLeft size={18} /></button>
        <button type="button" className="calendar-nav-btn" aria-label="Next month" onClick={() => changeMonth(1)}><ChevronRight size={18} /></button>
      </div>
    </div>
  );

  const calendarContent = (
    <div className="calendar-page" style={getSiteFontStyle(config, 'calendar')}>
      {!onClose && (
        <header className="calendar-page-heading">
          <div>
            <span className="calendar-eyebrow"><CalendarDays size={14} /> CALENDAR</span>
            <h1>Calendar</h1>
          </div>
        </header>
      )}

      <section className="calendar-month-card" aria-label={`${calendarView === 'month' ? 'Monthly' : 'Weekly'} study calendar`}>
        {!onClose && calendarToolbar}

        <div className={`calendar-weekdays${calendarView === 'week' ? ' is-week-view' : ''}`} aria-hidden="true">
          {(calendarView === 'week' ? weekCells.map((day) => WEEK_DAYS[day.getDay()]) : WEEK_DAYS).map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}
        </div>
        <div className="calendar-grid-tray">
          <div className={`calendar-month-grid${calendarView === 'week' ? ' is-week-view' : ''}`}>
            {visibleDays.map((day) => {
            const key = dateKey(day);
            const seconds = totalsByDay[key] || 0;
            const inViewMonth = calendarView === 'week' || isInViewMonth(day);
            const planned = plannedByDay[day.getDay()] || [];
            const intensity = !inViewMonth || seconds === 0 ? 0
              : seconds < 3600 ? 1
                : seconds < 7200 ? 2
                  : seconds < 10800 ? 3 : 4;
            const today = key === dateKey(new Date());
            return (
              <button
                key={key}
                type="button"
                className={`calendar-day-cell heat-${intensity}${!inViewMonth ? ' adjacent' : ''}${planned.length ? ' has-plan' : ''}${calendarView === 'week' ? ' week-cell' : ''}${selectedKey === key ? ' selected' : ''}${today ? ' today' : ''}`}
                onClick={() => {
                  if (!inViewMonth) setViewMonth(new Date(day.getFullYear(), day.getMonth(), 1));
                  setSelectedDate(day);
                  setJumpDate(key);
                }}
                aria-pressed={selectedKey === key}
                aria-label={`${formatDisplayDate(day, { month: 'long', day: 'numeric', year: 'numeric' })}${inViewMonth ? `: ${formatDuration(seconds)} studied` : ''}${planned.length ? `. Planned: ${planned.map((item) => `${item.project}, ${item.subject}, ${formatDuration(item.targetSeconds)}`).join('; ')}` : ''}`}
                title={`${formatDisplayDate(day, { month: 'long', day: 'numeric' })} · ${formatDuration(seconds)} studied${planned.length ? ` · Planned: ${planned.map((item) => `${item.subject} ${formatDuration(item.targetSeconds)}`).join(', ')}` : ''}`}
              >
                <span className="calendar-day-number">{day.getDate()}</span>
                {today && <span className="calendar-today-mark">Today</span>}
                {!today && inViewMonth && intensity === 4 && <span className="calendar-day-mark" aria-hidden="true" />}
                {planned.length > 0 && <span className="calendar-day-plan-list">
                  {planned.map((item) => <span className="calendar-day-plan" key={`${key}-${item.id}`} style={{ '--plan-color': item.color }}><span>{item.project} · {item.subject}</span><strong>{formatDuration(item.targetSeconds)}</strong></span>)}
                </span>}
                {inViewMonth && seconds > 0 && <span className="calendar-day-total"><span>Studied</span>{formatDuration(seconds)}</span>}
              </button>
            );
          })}
          </div>
        </div>
        <div className="calendar-heat-legend"><span>Less</span><i className="heat-0" /><i className="heat-1" /><i className="heat-2" /><i className="heat-3" /><i className="heat-4" /><span>More study</span></div>
      </section>

      <section className="calendar-entries-section" aria-label="Selected day sessions">
        <TimerEntriesList entries={filteredEntries} setEntries={setEntries} projects={projects} user={user} selectedDate={selectedDate} hideRangeControls />
      </section>
    </div>
  );

  if (!onClose) return calendarContent;
  return createPortal((
    <div className="calendar-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="calendar-modal-dialog" role="dialog" aria-modal="true" aria-label="Calendar">
        <div className="calendar-modal-topbar">
          <span><CalendarDays size={15} /> Calendar</span>
          {calendarToolbar}
          <button type="button" className="calendar-modal-close" onClick={onClose} aria-label="Close calendar"><X size={18} /></button>
        </div>
        <div className="calendar-modal-scroll">{calendarContent}</div>
      </section>
    </div>
  ), document.body);
};
