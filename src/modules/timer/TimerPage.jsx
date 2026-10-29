import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Play,
  Square,
  Pause,
  Trash2,
  Save,
  Target,
  Search,
} from 'lucide-react';
import { AnalogueClockFace, HorologyArt, SessionTargetRings } from './TimerClock';
import { TimerEntriesList } from './TimerEntriesList';
import { TaskAgenda } from '../manage/TasksPanel';
import { ManualEntry } from './ManualEntry';
import { FocusPlanner } from './FocusPlanner';
import { CalendarPage } from '../calendar/CalendarPage';
import { formatDisplayDate } from '../../utils/dateFormat';
import { getSiteFontStyle, useSiteCustomization } from '../../context/SiteCustomizationContext';
import {
  CustomSelect,
  DEFAULT_PROJECTS,
  K_ACTIVE,
  K_ENTRIES,
  K_PROJECTS,
  TIMER_GOALS,
  fmtClock,
  fmtDur,
  getSubjectStudySchedule,
  readTimerPreferences,
  rj,
} from './TimerSupport';
import './Timer.css';
export const TimerPage = ({ user }) => {
  const { config, text } = useSiteCustomization();
  const projectsKey = user?.id ? `studyduel_user_${user.id}_projects` : K_PROJECTS;
  const activeKey = user?.id ? `studyduel_user_${user.id}_active_timer` : K_ACTIVE;
  const entriesKey = user?.id ? `studyduel_user_${user.id}_time_entries` : K_ENTRIES;
  const preferencesKey = user?.id ? `studyduel_user_${user.id}_preferences` : 'studyduel_demo_preferences';

  const [projects, setProjects] = useState(() => rj(projectsKey, user ? [] : DEFAULT_PROJECTS));
  const activeProjects = useMemo(() => projects.filter((project) => !project.archived), [projects]);
  const [activeTimer, setActiveTimer] = useState(() => rj(activeKey, null));
  const [entries, setEntries] = useState(() => rj(entriesKey, []));
  const [timerPreferences, setTimerPreferences] = useState(() => readTimerPreferences(preferencesKey));
  const [sessionGoalMode, setSessionGoalMode] = useState(() => readTimerPreferences(preferencesKey).defaultTimerMode);
  const [studyPanelTab, setStudyPanelTab] = useState('combos');
  const [keyboardComboIndex, setKeyboardComboIndex] = useState(-1);
  const comboCardRefs = useRef([]);

  const [selProj, setSelProj] = useState(
    () => rj(activeKey, null)?.projectId || rj(projectsKey, user ? [] : DEFAULT_PROJECTS).find((project) => !project.archived)?.id || ''
  );
  const [selSub, setSelSub] = useState(
    () => rj(activeKey, null)?.subjectId || rj(projectsKey, user ? [] : DEFAULT_PROJECTS).find((project) => !project.archived)?.subjects?.[0]?.id || ''
  );

  const [comboSearch, setComboSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeSearchIndex, setActiveSearchIndex] = useState(-1);
  const searchRef = useRef(null);
  const [pendingSelection, setPendingSelection] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const [pausedElapsed, setPausedElapsed] = useState(0);
  const [notice, setNotice] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const closeCalendar = useCallback(() => setCalendarOpen(false), []);

  // Live clock tick
  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000);
    const sync = () => setProjects(rj(projectsKey, user ? [] : DEFAULT_PROJECTS));
    window.addEventListener('storage', sync);
    return () => {
      clearInterval(tick);
      window.removeEventListener('storage', sync);
    };
  }, [projectsKey]);

  // Sync state
  useEffect(() => {
    localStorage.setItem(activeKey, JSON.stringify(activeTimer));
  }, [activeKey, activeTimer]);

  useEffect(() => {
    localStorage.setItem(entriesKey, JSON.stringify(entries));
  }, [entriesKey, entries]);

  useEffect(() => {
    const syncPreferences = (event) => {
      if (event?.detail?.preferencesKey && event.detail.preferencesKey !== preferencesKey) return;
      const nextPreferences = readTimerPreferences(preferencesKey);
      setTimerPreferences(nextPreferences);
      setSessionGoalMode((current) => activeTimer ? current : nextPreferences.defaultTimerMode || 'stopwatch');
    };
    window.addEventListener('studyduel:preferences-storage', syncPreferences);
    window.addEventListener('storage', syncPreferences);
    return () => {
      window.removeEventListener('studyduel:preferences-storage', syncPreferences);
      window.removeEventListener('storage', syncPreferences);
    };
  }, [preferencesKey, activeTimer]);

  useEffect(() => {
    const syncStoppedSession = () => {
      setActiveTimer(rj(activeKey, null));
      setEntries(rj(entriesKey, []));
      setIsPaused(false);
      setPausedElapsed(0);
    };
    window.addEventListener('studyduel:timer-storage', syncStoppedSession);
    return () => window.removeEventListener('studyduel:timer-storage', syncStoppedSession);
  }, [activeKey, entriesKey]);

  useEffect(() => {
    if (!activeTimer && (!selProj || !activeProjects.some((project) => project.id === selProj)) && activeProjects.length) {
      setSelProj(activeProjects[0].id);
      setSelSub(activeProjects[0].subjects?.[0]?.id || '');
    } else if (!activeTimer && !activeProjects.length && selProj) {
      setSelProj('');
      setSelSub('');
    }
  }, [activeProjects, activeTimer, selProj]);

  const activeProj = useMemo(
    () => activeTimer
      ? projects.find((p) => p.id === activeTimer.projectId)
      : activeProjects.find((p) => p.id === selProj),
    [projects, activeProjects, activeTimer, selProj]
  );

  const sessionProjectId = activeTimer?.projectId || selProj;
  const sessionProject = projects.find((project) => project.id === sessionProjectId);
  const sessionSubjectId = activeTimer ? activeTimer.subjectId || '' : selSub;
  const sessionSubject = sessionProject?.subjects?.find((subject) => subject.id === sessionSubjectId);

  // Elapsed computation
  const elapsed = useMemo(() => {
    if (!activeTimer) return 0;
    if (isPaused) return pausedElapsed;
    return Math.max(0, Math.floor((now.getTime() - activeTimer.startedAt) / 1000));
  }, [activeTimer, now, isPaused, pausedElapsed]);

  const sessionMode = activeTimer?.mode || sessionGoalMode || timerPreferences.defaultTimerMode || 'stopwatch';
  const sessionGoal = TIMER_GOALS.find((goal) => goal.id === sessionMode) || TIMER_GOALS[2];
  const sessionTargetRings = useMemo(() => {
    if (!sessionProject) return [];
    const goals = sessionSubject?.goals || {};
    const recurringGoals = [
      { id: 'daily', shortLabel: 'D', hours: Number(goals.daily) || 0 },
      { id: 'weekly', shortLabel: 'W', hours: Number(goals.weekly) || 0 },
      { id: 'monthly', shortLabel: 'M', hours: Number(goals.monthly) || 0 },
    ].filter((goal) => goal.hours > 0);

    const matchesSession = (entry) => {
      const projectMatches = entry.projectId ? entry.projectId === sessionProjectId : entry.projectName === sessionProject.name;
      if (!projectMatches) return false;
      if (!sessionSubject) return true;
      return entry.subjectId ? entry.subjectId === sessionSubjectId : entry.subjectName === sessionSubject.name;
    };
    const matchedEntries = entries.filter(matchesSession);
    const activeSeconds = activeTimer?.projectId === sessionProjectId
      && (!sessionSubjectId || activeTimer?.subjectId === sessionSubjectId) ? elapsed : 0;
    const periodStart = {
      daily: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
      monthly: new Date(now.getFullYear(), now.getMonth(), 1),
    };
    const weekDayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const preferredWeekStart = weekDayKeys.indexOf(timerPreferences.weekStart || 'monday');
    const weekStartDay = preferredWeekStart >= 0 ? preferredWeekStart : 1;
    periodStart.weekly = new Date(periodStart.daily);
    periodStart.weekly.setDate(periodStart.weekly.getDate() - ((periodStart.weekly.getDay() - weekStartDay + 7) % 7));

    const secondsSince = (start) => matchedEntries.reduce((total, entry) => (
      Number(entry.startedAt) >= start.getTime() && Number(entry.startedAt) <= now.getTime()
        ? total + (Number(entry.durationSeconds) || 0)
        : total
    ), 0) + activeSeconds;

    if (recurringGoals.length) {
      return recurringGoals.map((goal) => ({
        ...goal,
        completedSeconds: secondsSince(periodStart[goal.id]),
        targetSeconds: goal.hours * 3600,
        progress: Math.min(100, (secondsSince(periodStart[goal.id]) / (goal.hours * 3600)) * 100),
      }));
    }

    const estimatedHours = Number(sessionSubject?.estimateHours)
      || (!sessionSubject ? (sessionProject.subjects || []).reduce((total, subject) => total + (Number(subject.estimateHours) || 0), 0) : 0);
    if (estimatedHours <= 0) return [];
    const completedSeconds = matchedEntries.reduce((total, entry) => total + (Number(entry.durationSeconds) || 0), 0) + activeSeconds;
    return [{
      id: 'total',
      shortLabel: 'T',
      completedSeconds,
      targetSeconds: estimatedHours * 3600,
      progress: Math.min(100, (completedSeconds / (estimatedHours * 3600)) * 100),
    }];
  }, [activeTimer?.projectId, activeTimer?.subjectId, elapsed, entries, now, sessionProject, sessionProjectId, sessionSubject, sessionSubjectId, timerPreferences.weekStart]);
  const focusSchedule = getSubjectStudySchedule(sessionSubject);
  const focusGoalSecs = focusSchedule.targetHours * 3600;
  const focusIsPlannedToday = focusSchedule.studyDays.includes(now.getDay());
  const focusTodaySecs = entries
    .filter((entry) => {
      if (new Date(entry.startedAt).toDateString() !== now.toDateString()) return false;
      const matchesProject = entry.projectId ? entry.projectId === sessionProjectId : entry.projectName === sessionProject?.name;
      const matchesSubject = entry.subjectId ? entry.subjectId === sessionSubjectId : entry.subjectName === sessionSubject?.name;
      return matchesProject && matchesSubject;
    })
    .reduce((total, entry) => total + (Number(entry.durationSeconds) || 0), 0)
    + (activeTimer?.projectId === sessionProjectId && activeTimer?.subjectId === sessionSubjectId ? elapsed : 0);
  const focusGoalPct = focusGoalSecs ? Math.min(100, Math.round((focusTodaySecs / focusGoalSecs) * 100)) : 0;
  const focusGoalRemaining = Math.max(0, focusGoalSecs - focusTodaySecs);

  const hasStudyGoals = useMemo(() => activeProjects.some((project) => (project.subjects || []).some((subject) => (
    (Number(subject.goals?.daily) || 0) > 0 || (Number(subject.goals?.weekly) || 0) > 0 || (Number(subject.goals?.monthly) || 0) > 0
  ))), [activeProjects]);
  const activeStudyPanelTab = hasStudyGoals && studyPanelTab === 'plan' ? 'plan' : 'combos';

  const todayStudyPlan = useMemo(() => {
    const day = now.getDay();
    const todayKey = now.toDateString();
    const scheduled = [];
    activeProjects.forEach((project) => (project.subjects || []).forEach((subject) => {
      const { studyDays, targetHours, goalBasis, goalDaysLabel } = getSubjectStudySchedule(subject);
      if (!studyDays.includes(day) || !studyDays.length) return;

      const targetSeconds = targetHours * 3600;
      if (targetSeconds <= 0) return;

      const completedSeconds = entries.reduce((total, entry) => {
        if (new Date(entry.startedAt).toDateString() !== todayKey) return total;
        const matchesProject = entry.projectId ? entry.projectId === project.id : entry.projectName === project.name;
        const matchesSubject = entry.subjectId ? entry.subjectId === subject.id : entry.subjectName === subject.name;
        return matchesProject && matchesSubject ? total + (Number(entry.durationSeconds) || 0) : total;
      }, 0);
      const isCurrentSubject = activeTimer?.projectId === project.id && activeTimer?.subjectId === subject.id;
      const totalSeconds = completedSeconds + (isCurrentSubject ? elapsed : 0);
      scheduled.push({
        projectId: project.id,
        projectName: project.name,
        subjectId: subject.id,
        subjectName: subject.name,
        color: subject.color || project.color,
        goalBasis,
        goalDaysLabel,
        targetSeconds,
        completedSeconds: totalSeconds,
        remainingSeconds: Math.max(0, targetSeconds - totalSeconds),
        progress: Math.min(100, Math.round((totalSeconds / targetSeconds) * 100)),
      });
    }));
    return scheduled.sort((a, b) => (
      (a.progress - b.progress)
      || (b.remainingSeconds - a.remainingSeconds)
      || (b.targetSeconds - a.targetSeconds)
    ));
  }, [activeProjects, entries, now, activeTimer?.projectId, activeTimer?.subjectId, elapsed]);

  // Top 5 Frequently Used Combos
  const topCombos = useMemo(() => {
    const counts = new Map();
    const activeProjectIds = new Set(activeProjects.map((project) => project.id));

    entries.forEach((e) => {
      if (!activeProjectIds.has(e.projectId)) return;
      const k = `${e.projectId}::${e.subjectId || ''}`;
      const existing = counts.get(k) || {
        projectId: e.projectId,
        projectName: e.projectName,
        subjectId: e.subjectId || '',
        subjectName: e.subjectName || '',
        color: e.color || '#f3957f',
        count: 0,
        totalSeconds: 0,
        lastUsed: e.startedAt,
      };
      existing.count += 1;
      existing.totalSeconds += e.durationSeconds || 0;
      if (e.startedAt > existing.lastUsed) existing.lastUsed = e.startedAt;
      counts.set(k, existing);
    });

    const list = Array.from(counts.values()).sort(
      (a, b) => b.count - a.count || b.totalSeconds - a.totalSeconds
    );

    // If fewer than 5 from history, populate from projects/subjects
    if (list.length < 5 && activeProjects.length > 0) {
      const usedKeys = new Set(list.map((c) => `${c.projectId}::${c.subjectId}`));
      for (const p of activeProjects) {
        if (p.subjects && p.subjects.length > 0) {
          for (const s of p.subjects) {
            const k = `${p.id}::${s.id}`;
            if (!usedKeys.has(k)) {
              usedKeys.add(k);
              list.push({
                projectId: p.id,
                projectName: p.name,
                subjectId: s.id,
                subjectName: s.name,
                color: s.color || p.color || '#f3957f',
                count: 0,
                totalSeconds: 0,
                isRecommended: true,
              });
              if (list.length >= 5) break;
            }
          }
        } else {
          const k = `${p.id}::`;
          if (!usedKeys.has(k)) {
            usedKeys.add(k);
            list.push({
              projectId: p.id,
              projectName: p.name,
              subjectId: '',
              subjectName: '',
              color: p.color || '#f3957f',
              count: 0,
              totalSeconds: 0,
              isRecommended: true,
            });
          }
        }
        if (list.length >= 5) break;
      }
    }

    return list.slice(0, 5);
  }, [entries, activeProjects]);

  const searchCombos = useMemo(
    () => activeProjects.flatMap((project) => {
      const subjects = project.subjects?.length ? project.subjects : [{ id: '', name: 'General Study' }];
      return subjects.map((subject) => ({
        projectId: project.id,
        projectName: project.name,
        subjectId: subject.id || '',
        subjectName: subject.name,
        color: subject.color || project.color || '#8086d4',
      }));
    }),
    [activeProjects]
  );
  const searchMatches = useMemo(() => {
    const query = comboSearch.trim().toLocaleLowerCase();
    if (!query) return [];
    return searchCombos.filter((item) =>
      `${item.projectName} ${item.subjectName}`.toLocaleLowerCase().includes(query)
    ).slice(0, 8);
  }, [comboSearch, searchCombos]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!searchRef.current?.contains(event.target)) setSearchOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  const showSelectionPreview = (projectId, subjectId) => {
    const project = projects.find((item) => item.id === projectId);
    const subject = project?.subjects?.find((item) => item.id === subjectId);
    if (!project || !subject) {
      setPendingSelection(null);
      return;
    }
    setPendingSelection({
      projectId,
      subjectId,
      projectName: project.name,
      subjectName: subject.name,
      color: subject.color || project.color || '#8086d4',
      expiresAt: Date.now() + 30_000,
    });
  };

  const chooseSearchResult = (item) => {
    setSelProj(item.projectId);
    setSelSub(item.subjectId);
    setComboSearch('');
    setSearchOpen(false);
    setActiveSearchIndex(-1);
    if (activeTimer) startTimer(item.projectId, item.subjectId);
    else showSelectionPreview(item.projectId, item.subjectId);
  };

  useEffect(() => {
    if (!pendingSelection || activeTimer) return undefined;
    const timeout = window.setTimeout(() => setPendingSelection(null), Math.max(0, pendingSelection.expiresAt - Date.now()));
    return () => window.clearTimeout(timeout);
  }, [pendingSelection, activeTimer]);

  // Start Session
  const startTimer = (pId = selProj, sId = selSub) => {
    setPendingSelection(null);
    setKeyboardComboIndex(-1);
    const proj = projects.find((p) => p.id === pId);
    if (!proj) {
      setNotice('Please select a project to start.');
      return;
    }
    const sub = proj.subjects?.find((s) => s.id === sId);
    const t = Date.now();

    // If a session was already active, save it first
    if (activeTimer) {
      const dur = Math.max(1, Math.floor((t - activeTimer.startedAt) / 1000));
      setEntries((cur) => [
        {
          id: crypto.randomUUID(),
          ...activeTimer,
          endedAt: t,
          durationSeconds: dur,
        },
        ...cur,
      ]);
    }

    setActiveTimer({
      projectId: proj.id,
      projectName: proj.name,
      subjectId: sub?.id || '',
      subjectName: sub?.name || '',
      color: sub?.color || proj.color || '#f3957f',
      mode: sessionGoalMode || timerPreferences.defaultTimerMode || 'stopwatch',
      startedAt: t,
    });
    setSelProj(proj.id);
    setSelSub(sub?.id || '');
    setIsPaused(false);
    setPausedElapsed(0);
    setNotice('');
  };
  const startTimerRef = useRef(startTimer);
  startTimerRef.current = startTimer;

  useEffect(() => {
    const onKeyDown = (event) => {
      const target = event.target;
      if (
        event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
        target?.isContentEditable ||
        target?.closest?.('input, textarea, select, [contenteditable="true"], .t-select-menu')
      ) return;

      if (!activeTimer && /^[1-5]$/.test(event.key)) {
        const index = Number(event.key) - 1;
        const combo = topCombos[index];
        if (!combo) return;
        event.preventDefault();
        setStudyPanelTab('combos');
        setKeyboardComboIndex(index);
        setSelProj(combo.projectId);
        setSelSub(combo.subjectId || '');
        return;
      }

      if (!activeTimer && event.key === 'Enter' && keyboardComboIndex >= 0) {
        const combo = topCombos[keyboardComboIndex];
        if (!combo) return;
        event.preventDefault();
        event.stopPropagation();
        startTimerRef.current(combo.projectId, combo.subjectId || '');
      } else if (event.key === 'Escape' && keyboardComboIndex >= 0) {
        setKeyboardComboIndex(-1);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [activeTimer, keyboardComboIndex, topCombos]);

  useEffect(() => {
    if (activeStudyPanelTab !== 'combos' || keyboardComboIndex < 0) return;
    comboCardRefs.current[keyboardComboIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeStudyPanelTab, keyboardComboIndex]);

  // Stop Session
  const stopTimer = () => {
    if (!activeTimer) return;
    const t = Date.now();
    const dur = Math.max(1, isPaused ? pausedElapsed : Math.floor((t - activeTimer.startedAt) / 1000));

    setEntries((cur) => [
      {
        id: crypto.randomUUID(),
        ...activeTimer,
        endedAt: t,
        durationSeconds: dur,
      },
      ...cur,
    ]);

    setActiveTimer(null);
    setIsPaused(false);
    setPausedElapsed(0);
    setNotice(`Session Logged · ${fmtDur(dur)}`);
    setTimeout(() => setNotice(''), 5000);
    if (timerPreferences.soundEnabled) {
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          const context = new AudioContextClass();
          if (context.state === 'suspended') context.resume();
          const startedAt = context.currentTime;
          const osc1 = context.createOscillator();
          const gain1 = context.createGain();
          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(528, startedAt);

          const osc2 = context.createOscillator();
          const gain2 = context.createGain();
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(1056, startedAt);

          gain1.gain.setValueAtTime(0.24, startedAt);
          gain1.gain.exponentialRampToValueAtTime(0.0001, startedAt + 1.3);

          gain2.gain.setValueAtTime(0.08, startedAt);
          gain2.gain.exponentialRampToValueAtTime(0.0001, startedAt + 1.3);

          osc1.connect(gain1);
          osc2.connect(gain2);
          gain1.connect(context.destination);
          gain2.connect(context.destination);

          osc1.start(startedAt);
          osc2.start(startedAt);
          osc1.stop(startedAt + 1.3);
          osc2.stop(startedAt + 1.3);
          osc1.onended = () => {
            try { context.close(); } catch {}
          };
        }
      } catch (error) {
        console.warn('Unable to play the completion chime.', error);
      }
    }
  };

  const discardTimer = () => {
    if (!activeTimer) return;
    setActiveTimer(null);
    setIsPaused(false);
    setPausedElapsed(0);
    setNotice('Session discarded');
    setTimeout(() => setNotice(''), 4000);
  };

  // Pause / Resume
  const togglePause = () => {
    if (!activeTimer) return;
    if (isPaused) {
      const adjustedStart = Date.now() - pausedElapsed * 1000;
      setActiveTimer((prev) => ({ ...prev, startedAt: adjustedStart }));
      setIsPaused(false);
    } else {
      setPausedElapsed(elapsed);
      setIsPaused(true);
    }
  };

  const projOptions = activeProjects.map((p) => ({ value: p.id, label: p.name, color: p.color }));
  const subOptions = [
    { value: '', label: 'No subject' },
    ...(activeProj?.subjects || []).map((s) => ({ value: s.id, label: s.name, color: s.color })),
  ];

  return (
    <div className="timer-root" style={getSiteFontStyle(config, 'timer')}>
      {/* ── MAIN HOROLOGICAL COMMAND DECK ────────────────── */}
      <section className="timer-deck-card">
        {/* ── LEFT COLUMN: Session Command & Top 5 Combos ── */}
        <div className="timer-cmd-column">
          {notice && <span className="timer-flash-notice" role="status" aria-live="polite">{notice}</span>}

          {/* Search projects and subprojects before choosing a session. */}
          <div className="timer-combo-search" ref={searchRef}>
            <Search size={17} aria-hidden="true" />
            <ManualEntry projects={activeProjects} onSave={entry => setEntries(current => [entry, ...current])} />
            <input
              type="search"
              value={comboSearch}
              onFocus={() => setSearchOpen(true)}
              onChange={(event) => { setComboSearch(event.target.value); setSearchOpen(true); setActiveSearchIndex(-1); }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setSearchOpen(false);
                  setActiveSearchIndex(-1);
                } else if (event.key === 'ArrowDown' && searchMatches.length) {
                  event.preventDefault();
                  setSearchOpen(true);
                  setActiveSearchIndex((current) => current < 0 ? 0 : (current + 1) % searchMatches.length);
                } else if (event.key === 'ArrowUp' && searchMatches.length) {
                  event.preventDefault();
                  setSearchOpen(true);
                  setActiveSearchIndex((current) => current < 0 ? searchMatches.length - 1 : (current - 1 + searchMatches.length) % searchMatches.length);
                } else if (event.key === 'Enter' && pendingSelection && !comboSearch.trim()) {
                  event.preventDefault();
                  startTimer(pendingSelection.projectId, pendingSelection.subjectId || '');
                } else if (event.key === 'Enter' && searchMatches.length) {
                  event.preventDefault();
                  chooseSearchResult(searchMatches[activeSearchIndex >= 0 ? activeSearchIndex : 0]);
                }
              }}
              placeholder={text('timer', 'searchPlaceholder', 'Search projects or subjects to start a session')}
              aria-label="Search projects and subjects"
              aria-autocomplete="list"
              aria-expanded={searchOpen && Boolean(comboSearch.trim())}
              aria-controls="timer-search-results"
              aria-activedescendant={searchOpen && activeSearchIndex >= 0 ? `timer-search-result-${activeSearchIndex}` : undefined}
            />
            {searchOpen && comboSearch.trim() && (
              <div className="timer-search-results" id="timer-search-results" role="listbox" aria-label="Project and subject results">
                {searchMatches.length ? searchMatches.map((item, index) => (
                  <button
                    key={`${item.projectId}-${item.subjectId || 'general'}`}
                    id={`timer-search-result-${index}`}
                    type="button"
                    className={`timer-search-result${activeSearchIndex === index ? ' is-highlighted' : ''}`}
                    role="option"
                    aria-selected={activeSearchIndex === index}
                    onMouseEnter={() => setActiveSearchIndex(index)}
                    onClick={() => chooseSearchResult(item)}
                  >
                    <span className="timer-search-result-copy">
                      <strong>{item.projectName}</strong>
                      <span>{item.subjectName}</span>
                    </span>
                    <Play size={14} aria-hidden="true" />
                  </button>
                )) : (
                  <div className="timer-search-empty">No matching projects or subjects</div>
                )}
              </div>
            )}
          </div>

          {/* 1. PROJECT & SUBJECT CONFIGURATION (ON TOP) */}
          <div className="timer-primary-selectors">
            <div className="t-section-header">
              <h2 className="t-section-title">{text('timer', 'activeSectionTitle', 'ACTIVE PROJECT & SUBJECT')}</h2>
              <span className="t-section-sub">{text('timer', 'activeSectionSub', 'Configure Session')}</span>
            </div>

            <div className="timer-selects-row">
              <div className="timer-field">
                <label className="timer-field-label">{text('timer', 'projectLabel', 'PROJECT')}</label>
                <CustomSelect
                  value={selProj}
                  onChange={(v) => {
                    setSelProj(v);
                    const p = projects.find((x) => x.id === v);
                    const firstSub = p?.subjects?.[0]?.id || '';
                    setSelSub(firstSub);
                    if (!activeTimer && firstSub) showSelectionPreview(v, firstSub);
                    else if (!activeTimer) setPendingSelection(null);
                    if (
                      activeTimer &&
                      (v !== activeTimer.projectId || firstSub !== (activeTimer.subjectId || ''))
                    ) {
                      startTimer(v, firstSub);
                    }
                  }}
                  options={projOptions}
                  placeholder="Select project"
                  disabled={!activeProjects.length}
                />
              </div>

              <div className="timer-field">
                <label className="timer-field-label">{text('timer', 'subjectLabel', 'SUBJECT')}</label>
                <CustomSelect
                  value={selSub}
                  onChange={(v) => {
                    setSelSub(v);
                    if (!activeTimer && v) showSelectionPreview(selProj, v);
                    else if (!activeTimer) setPendingSelection(null);
                    if (activeTimer && v !== (activeTimer.subjectId || '')) {
                      startTimer(selProj, v);
                    }
                  }}
                  options={subOptions}
                  placeholder="No subject"
                  disabled={!activeProj?.subjects?.length}
                  accentValue
                />
              </div>
            </div>

          </div>

          {/* Shared tab panel keeps quick launches and today's agenda aligned. */}
          <section className="timer-top-combos-section timer-insights-panel" aria-label="Study shortcuts and today's plan">
            <div className="timer-insights-tabbar" role="tablist" aria-label="Timer panel">
              <div className={`timer-insights-tabs${activeStudyPanelTab === 'plan' ? ' is-plan' : ''}${hasStudyGoals ? '' : ' is-single'}`}>
                <button
                  id="timer-tab-combos"
                  type="button"
                  role="tab"
                  aria-selected={activeStudyPanelTab === 'combos'}
                  aria-controls="timer-panel-content"
                  className={`timer-insights-tab${activeStudyPanelTab === 'combos' ? ' is-active' : ''}`}
                  onClick={() => setStudyPanelTab('combos')}
                >
                  <span>{text('timer', 'frequentTitle', 'TOP FREQUENT COMBOS')}</span>
                  <small>{topCombos.length}</small>
                </button>
                {hasStudyGoals && (
                  <button
                    id="timer-tab-plan"
                    type="button"
                    role="tab"
                    aria-selected={activeStudyPanelTab === 'plan'}
                    aria-controls="timer-panel-content"
                    className={`timer-insights-tab${activeStudyPanelTab === 'plan' ? ' is-active' : ''}`}
                    onClick={() => setStudyPanelTab('plan')}
                  >
                    <span>FOCUS PLANNER</span>
                  </button>
                )}
              </div>
              {activeStudyPanelTab === 'combos' && <span className="timer-insights-tab-hint">1–5 select · Enter start</span>}
            </div>

            <div
              id="timer-panel-content"
              className={`timer-insights-pane is-${activeStudyPanelTab}`}
              role="tabpanel"
              aria-labelledby={activeStudyPanelTab === 'combos' ? 'timer-tab-combos' : 'timer-tab-plan'}
              tabIndex={0}
            >
            {activeStudyPanelTab === 'combos' ? (
            <div className="t-combos-grid">
              {topCombos.map((combo, index) => {
                const isComboActive =
                  activeTimer &&
                  activeTimer.projectId === combo.projectId &&
                  (activeTimer.subjectId || '') === (combo.subjectId || '');

                return (
                  <div
                    key={`${combo.projectId}-${combo.subjectId || 'none'}`}
                    ref={(node) => { comboCardRefs.current[index] = node; }}
                    className={`t-combo-card${isComboActive ? ' is-active' : ''}${keyboardComboIndex === index ? ' is-keyboard-selected' : ''}`}
                    aria-keyshortcuts={`${index + 1} Enter`}
                  >
                    <div className="t-combo-info">
                      <div className="t-combo-head">
                        <span className="t-combo-rank">0{index + 1}</span>
                        <span className="t-combo-proj-name">{combo.projectName}</span>
                      </div>
                      <div className="t-combo-sub-name">
                        {combo.subjectName || 'General Study'}
                      </div>
                      <div className="t-combo-meta">
                        {combo.totalSeconds > 0
                          ? `${fmtDur(combo.totalSeconds)} logged · ${combo.count} sessions`
                          : 'Recommended Preset'}
                      </div>
                    </div>

                    <div className="t-combo-action">
                      {isComboActive ? (
                        <button
                          type="button"
                          className="t-combo-btn stop"
                          onClick={stopTimer}
                          title="Stop session"
                        >
                          <Square size={13} fill="currentColor" strokeWidth={0} />
                          {text('timer', 'stopButton', 'Stop')}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="t-combo-btn start"
                          onClick={() => startTimer(combo.projectId, combo.subjectId)}
                          title="Start timer for this combo"
                        >
                          <Play size={12} fill="currentColor" strokeWidth={0} />
                          {text('timer', 'startButton', 'Start')}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            ) : (
              <FocusPlanner projects={activeProjects} entries={entries} activeTimer={activeTimer} elapsed={elapsed} now={now} weekStart={timerPreferences.weekStart || 'monday'} onStart={startTimer} />
            )}
            </div>
          </section>

        </div>

        {/* ── RIGHT COLUMN: Horological Center (Clock -> Stopwatch) ── */}
        <div className="timer-horology-column">
          <div className={`horology-face-container${activeTimer ? ' mode-stopwatch' : ' mode-clock'}`}>
            {activeTimer ? (
              <section className="timer-running-session-card" aria-label="Running study session">
                <div className="timer-running-status" role="status">
                  <span aria-hidden="true" />
                  {isPaused ? 'PAUSED' : 'RUNNING'}
                </div>
                {sessionTargetRings.length > 0 && (
                  <div className="session-target-ring-key" aria-label="Target completion">
                    {sessionTargetRings.map((ring) => (
                      <span key={ring.id} title={`${ring.id} target completion`}>
                        <i className={`is-${ring.id}`} />
                        {ring.id === 'total' ? 'Total' : ring.id === 'daily' ? 'Daily' : ring.id === 'weekly' ? 'Weekly' : 'Monthly'}
                        <b>{Math.round(ring.progress)}%</b>
                      </span>
                    ))}
                  </div>
                )}

                <div className="timer-running-hero">
                  <div className="timer-running-identity">
                    <span>PROJECT &amp; SUBPROJECT</span>
                    <strong>{activeTimer.projectName}</strong>
                    {activeTimer.subjectName && <b style={{ color: sessionSubject?.color || sessionProject?.color || activeTimer.color || 'var(--sd-coral)' }}>{activeTimer.subjectName}</b>}
                  </div>
                  <span className="timer-running-divider" aria-hidden="true" />
                  <div
                    className="timer-running-progress"
                    role="img"
                    aria-label={sessionTargetRings.length
                      ? sessionTargetRings.map((ring) => `${ring.id} target ${Math.round(ring.progress)} percent complete`).join(', ')
                      : 'No study target configured'}
                  >
                    {sessionTargetRings.length ? (
                      <SessionTargetRings rings={sessionTargetRings} />
                    ) : (
                      <div className="session-target-rings-empty"><Target size={22} /><span>No target</span></div>
                    )}
                  </div>
                  <div className="timer-running-elapsed" aria-live="polite">
                    <div><span>{fmtClock(elapsed)}</span><small>.{String(Math.floor(now.getMilliseconds() / 10)).padStart(2, '0')}</small></div>
                    <p>{sessionGoal.seconds ? `Target: ${sessionGoal.label}` : 'Open timer'}</p>
                  </div>
                </div>

                <div className="timer-running-actions">
                  <button type="button" className="horology-btn-stop" onClick={stopTimer}>
                    <Square size={16} fill="currentColor" strokeWidth={0} />
                    {text('timer', 'stopSaveButton', 'Stop & Save')}
                  </button>
                  <button type="button" className={`horology-btn-sub${isPaused ? ' paused' : ''}`} onClick={togglePause}>
                    {isPaused ? <Play size={15} fill="currentColor" /> : <Pause size={15} />}
                    {isPaused ? text('timer', 'resumeButton', 'Resume') : text('timer', 'pauseButton', 'Pause')}
                  </button>
                  <button type="button" className="horology-btn-discard" onClick={discardTimer}>
                    <Trash2 size={14} />
                    Discard
                  </button>
                </div>

                <label className="timer-running-note">
                  <span><i aria-hidden="true" /> SESSION NOTE</span>
                  <input
                    value={activeTimer.note || ''}
                    onChange={(event) => setActiveTimer((current) => current ? { ...current, note: event.target.value } : current)}
                    placeholder={text('timer', 'sessionNotePlaceholder', 'Add a note about this session…')}
                    maxLength={240}
                    aria-label="Session note to save with this entry"
                  />
                  <button type="button" onClick={(event) => event.currentTarget.blur()} aria-label="Save session note">
                    <Save size={12} aria-hidden="true" />
                    Save
                  </button>
                </label>
              </section>
            ) : (
              <>
                <HorologyArt isRunning={!!pendingSelection} />
                <div className="horology-dial-wrapper">
                  <div className="horology-dial-mode" key={pendingSelection ? 'preview' : 'clock'}>
                    {pendingSelection ? (
                      <div key={pendingSelection.expiresAt} className="horology-selection-preview">
                        <span className="selection-preview-kicker">SELECTED FOR THIS SESSION</span>
                        <strong className="selection-preview-project">{pendingSelection.projectName}</strong>
                        <span className="selection-preview-divider" />
                        <span className="selection-preview-subject">{pendingSelection.subjectName}</span>
                        <span className="selection-preview-caption">Ready when you are</span>
                        <span className="selection-preview-timeout" aria-hidden="true"><i /></span>
                      </div>
                    ) : <AnalogueClockFace now={now} />}
                  </div>
                  <svg className="horology-focus-ring" viewBox="0 0 320 320" aria-hidden="true">
                    <circle className="horology-focus-ring-track" cx="160" cy="160" r="150" />
                  </svg>
                </div>
                <div className="horology-wall-block">
                  <time className="horology-wall-time">{now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}</time>
                  <span className="horology-wall-date">{formatDisplayDate(now, { weekday: 'long', month: 'long', day: 'numeric' })}</span>
                </div>
                <div className="horology-actions">
                  <div className="horology-idle-actions">
                    <button type="button" className="horology-btn-start" onClick={() => startTimer()} disabled={!projects.length}>
                      <Play size={16} fill="currentColor" strokeWidth={0} />
                      {text('timer', 'startSessionButton', 'Start Session')}
                    </button>
                  </div>
                </div>
              </>
            )}

          </div>

          <TaskAgenda user={user} projects={activeProjects} studyPlan={todayStudyPlan} onStart={startTimer} />
        </div>
      </section>

      {/* ── SESSION HISTORY LIST ─────────────────────────── */}
      <TimerEntriesList entries={entries} setEntries={setEntries} projects={projects} user={user} hideProjectColors onOpenCalendar={() => setCalendarOpen(true)} />
      {calendarOpen && (
        <CalendarPage
          user={user}
          entries={entries}
          setEntries={setEntries}
          projects={projects}
          onClose={closeCalendar}
        />
      )}
    </div>
  );
};
