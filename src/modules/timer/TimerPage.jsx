import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Play,
  Square,
  Pause,
  ChevronDown,
  Search,
} from 'lucide-react';
import { AnalogueClockFace, StopwatchFace, HorologyArt } from './TimerClock';
import { TimerEntriesList } from './TimerEntriesList';
import { CalendarPage } from '../calendar/CalendarPage';
import './Timer.css';

/* ── Storage Keys ───────────────────────────── */
const K_PROJECTS = 'studyduel_demo_projects';
const K_ACTIVE = 'studyduel_demo_active_timer';
const K_ENTRIES = 'studyduel_demo_time_entries';

const rj = (key, fallback) => {
  try {
    const v = JSON.parse(localStorage.getItem(key) || 'null');
    return v ?? fallback;
  } catch {
    return fallback;
  }
};

const pad = (n) => String(Math.floor(n)).padStart(2, '0');
const fmtClock = (s) => `${pad(s / 3600)}:${pad((s % 3600) / 60)}:${pad(s % 60)}`;
const fmtDur = (s) => {
  if (!s || s <= 0) return '0m';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

/* ── Default Sample Projects ───────────────── */
const DEFAULT_PROJECTS = [
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
const CustomSelect = ({ value, onChange, options, placeholder, disabled, accentValue = false }) => {
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
        {selected?.color && <span className="t-sel-dot" style={{ background: selected.color }} />}
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
              {o.color && <span className="t-sel-dot" style={{ background: o.color }} />}
              <span className="t-opt-label">{o.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/* ── Main Timer Page ───────────────────────── */
export const TimerPage = ({ user }) => {
  const projectsKey = user?.id ? `studyduel_user_${user.id}_projects` : K_PROJECTS;
  const activeKey = user?.id ? `studyduel_user_${user.id}_active_timer` : K_ACTIVE;
  const entriesKey = user?.id ? `studyduel_user_${user.id}_time_entries` : K_ENTRIES;
  const preferencesKey = user?.id ? `studyduel_user_${user.id}_preferences` : 'studyduel_demo_preferences';

  const [projects, setProjects] = useState(() => rj(projectsKey, user ? [] : DEFAULT_PROJECTS));
  const activeProjects = useMemo(() => projects.filter((project) => !project.archived), [projects]);
  const [activeTimer, setActiveTimer] = useState(() => rj(activeKey, null));
  const [entries, setEntries] = useState(() => rj(entriesKey, []));
  const [timerPreferences, setTimerPreferences] = useState(() => rj(preferencesKey, { defaultTimerMode: '50m', soundEnabled: true }));

  const [selProj, setSelProj] = useState(
    () => rj(activeKey, null)?.projectId || rj(projectsKey, user ? [] : DEFAULT_PROJECTS).find((project) => !project.archived)?.id || ''
  );
  const [selSub, setSelSub] = useState(
    () => rj(activeKey, null)?.subjectId || rj(projectsKey, user ? [] : DEFAULT_PROJECTS).find((project) => !project.archived)?.subjects?.[0]?.id || ''
  );

  const [comboSearch, setComboSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
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
      setTimerPreferences(rj(preferencesKey, { defaultTimerMode: '50m', soundEnabled: true }));
    };
    window.addEventListener('studyduel:preferences-storage', syncPreferences);
    window.addEventListener('storage', syncPreferences);
    return () => {
      window.removeEventListener('studyduel:preferences-storage', syncPreferences);
      window.removeEventListener('storage', syncPreferences);
    };
  }, [preferencesKey]);

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
  const comboEntries = useMemo(() => entries.filter((entry) => {
    const projectMatches = entry.projectId
      ? entry.projectId === sessionProjectId
      : entry.projectName === sessionProject?.name;
    const subjectMatches = entry.subjectId
      ? entry.subjectId === sessionSubjectId
      : (entry.subjectName || '') === (sessionSubject?.name || '');
    return projectMatches && subjectMatches;
  }), [entries, sessionProjectId, sessionProject?.name, sessionSubjectId, sessionSubject?.name]);
  const averageComboSeconds = comboEntries.length
    ? Math.round(comboEntries.reduce((sum, entry) => sum + (Number(entry.durationSeconds) || 0), 0) / comboEntries.length)
    : 0;

  // Elapsed computation
  const elapsed = useMemo(() => {
    if (!activeTimer) return 0;
    if (isPaused) return pausedElapsed;
    return Math.max(0, Math.floor((now.getTime() - activeTimer.startedAt) / 1000));
  }, [activeTimer, now, isPaused, pausedElapsed]);

  // Today summary
  const todaySecs = useMemo(() => {
    const today = new Date().toDateString();
    return entries
      .filter((e) => new Date(e.startedAt).toDateString() === today)
      .reduce((s, e) => s + (e.durationSeconds || 0), 0);
  }, [entries]);

  const todaySessionsCount = useMemo(() => {
    const today = new Date().toDateString();
    return entries.filter((e) => new Date(e.startedAt).toDateString() === today).length;
  }, [entries]);

  const goalSecs = 4 * 3600;
  const goalPct = Math.min(100, Math.round((todaySecs / goalSecs) * 100));

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
      mode: timerPreferences.defaultTimerMode || '50m',
      startedAt: t,
    });
    setSelProj(proj.id);
    setSelSub(sub?.id || '');
    setIsPaused(false);
    setPausedElapsed(0);
    setNotice('');
  };

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
    <div className="timer-root">
      {/* ── MAIN HOROLOGICAL COMMAND DECK ────────────────── */}
      <section className="timer-deck-card">
        {/* ── LEFT COLUMN: Session Command & Top 5 Combos ── */}
        <div className="timer-cmd-column">
          {/* Keep the command area clear while idle; show status only for a live session. */}
          {(activeTimer || notice) && (
            <header className="timer-cmd-header">
              {activeTimer && (
                <div className="timer-deck-badge">
                  <span className={`deck-badge-dot${!isPaused ? ' live' : ''}`} />
                  <span className="deck-badge-text">{isPaused ? 'SESSION PAUSED' : 'RECORDING FOCUS'}</span>
                </div>
              )}
              {notice && <span className="timer-flash-notice">{notice}</span>}
            </header>
          )}

          {/* Search projects and subprojects before choosing a session. */}
          <div className="timer-combo-search" ref={searchRef}>
            <Search size={17} aria-hidden="true" />
            <input
              type="search"
              value={comboSearch}
              onFocus={() => setSearchOpen(true)}
              onChange={(event) => { setComboSearch(event.target.value); setSearchOpen(true); }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setSearchOpen(false);
                if (event.key === 'Enter' && searchMatches[0]) {
                  event.preventDefault();
                  chooseSearchResult(searchMatches[0]);
                }
              }}
              placeholder="Search projects or subjects to start a session"
              aria-label="Search projects and subjects"
              aria-autocomplete="list"
            />
            {searchOpen && comboSearch.trim() && (
              <div className="timer-search-results" role="listbox" aria-label="Project and subject results">
                {searchMatches.length ? searchMatches.map((item) => (
                  <button
                    key={`${item.projectId}-${item.subjectId || 'general'}`}
                    type="button"
                    className="timer-search-result"
                    role="option"
                    onClick={() => chooseSearchResult(item)}
                  >
                    <span className="timer-search-result-dot" style={{ background: item.color }} />
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
              <h2 className="t-section-title">ACTIVE PROJECT & SUBJECT</h2>
              <span className="t-section-sub">Configure Session</span>
            </div>

            <div className="timer-selects-row">
              <div className="timer-field">
                <label className="timer-field-label">PROJECT</label>
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
                <label className="timer-field-label">SUBJECT</label>
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

          {/* 2. TOP 5 COMBOS SECTION (BELOW PROJECT/SUBJECT) */}
          <section className="timer-top-combos-section" aria-label="Top 5 Project Combos">
            <div className="t-section-header">
              <h2 className="t-section-title">TOP FREQUENT COMBOS</h2>
              <span className="t-section-sub">1-Click Launch</span>
            </div>

            <div className="t-combos-grid">
              {topCombos.map((combo, index) => {
                const isComboActive =
                  activeTimer &&
                  activeTimer.projectId === combo.projectId &&
                  (activeTimer.subjectId || '') === (combo.subjectId || '');

                return (
                  <div
                    key={`${combo.projectId}-${combo.subjectId || 'none'}`}
                    className={`t-combo-card${isComboActive ? ' is-active' : ''}`}
                  >
                    <div className="t-combo-info">
                      <div className="t-combo-head">
                        <span className="t-combo-rank">0{index + 1}</span>
                        <span className="t-combo-dot" style={{ background: combo.color }} />
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
                          Stop
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="t-combo-btn start"
                          onClick={() => startTimer(combo.projectId, combo.subjectId)}
                          title="Start timer for this combo"
                        >
                          <Play size={12} fill="currentColor" strokeWidth={0} />
                          Start
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

        </div>

        {/* ── RIGHT COLUMN: Horological Center (Clock -> Stopwatch) ── */}
        <div className="timer-horology-column">
          <div className={`horology-face-container${activeTimer ? ' mode-stopwatch' : ' mode-clock'}`}>
            {/* Minimalist Horology Dial Halo Artwork */}
            <HorologyArt isRunning={!!activeTimer || !!pendingSelection} />

            {/* Central Dial: Swiss Analogue Clock -> High-Precision Chronograph */}
            <div className="horology-dial-wrapper">
              {activeTimer ? (
                <StopwatchFace
                  elapsed={elapsed}
                  isRunning={!isPaused}
                  targetSeconds={null}
                />
              ) : pendingSelection ? (
                <div key={pendingSelection.expiresAt} className="horology-selection-preview">
                  <span className="selection-preview-kicker">SELECTED FOR THIS SESSION</span>
                  <strong className="selection-preview-project">{pendingSelection.projectName}</strong>
                  <span className="selection-preview-divider" />
                  <span className="selection-preview-subject">{pendingSelection.subjectName}</span>
                  <span className="selection-preview-caption">Ready when you are</span>
                  <span className="selection-preview-timeout" aria-hidden="true"><i /></span>
                </div>
              ) : (
                <AnalogueClockFace now={now} />
              )}
            </div>

            {/* Digital Readout & Status */}
            {activeTimer ? (
              <div className="chronograph-digital-block" aria-live="polite">
                <div className="chrono-status-line">
                  <span className="chrono-dot live" />
                  <span className="chrono-tag">
                    <span className="chrono-project-name">
                      {activeTimer.projectName}
                    </span>
                    {activeTimer.subjectName && <>
                      <span className="chrono-name-separator" aria-hidden="true">·</span>
                      <span className="chrono-subject-name" style={{ color: sessionSubject?.color || sessionProject?.color || activeTimer.color || 'var(--sd-coral)' }}>
                        {activeTimer.subjectName}
                      </span>
                    </>}
                  </span>
                </div>
                <div className="chrono-elapsed-digits">
                  <span className="chrono-main">{fmtClock(elapsed)}</span>
                  <span className="chrono-ms">.{Math.floor((now.getMilliseconds() / 100)) % 10}</span>
                </div>
              </div>
            ) : (
              <div className="horology-wall-block">
                <time className="horology-wall-time">
                  {now.toLocaleTimeString(undefined, {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true,
                  })}
                </time>
                <span className="horology-wall-date">
                  {now.toLocaleDateString(undefined, {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="horology-actions">
              {activeTimer ? (
                <div className="chronograph-buttons">
                  <button
                    type="button"
                    className="horology-btn-stop"
                    onClick={stopTimer}
                  >
                    <Square size={16} fill="currentColor" strokeWidth={0} />
                    Stop & Save
                  </button>

                  <button
                    type="button"
                    className={`horology-btn-sub${isPaused ? ' paused' : ''}`}
                    onClick={togglePause}
                  >
                    {isPaused ? <Play size={15} fill="currentColor" /> : <Pause size={15} />}
                    {isPaused ? 'Resume' : 'Pause'}
                  </button>
                </div>
              ) : (
                <div className="horology-idle-actions">
                  <button
                    type="button"
                    className="horology-btn-start"
                    onClick={() => startTimer()}
                    disabled={!projects.length}
                  >
                    <Play size={16} fill="currentColor" strokeWidth={0} />
                    Start Session
                  </button>
                </div>
              )}
            </div>

            {activeTimer && (
              <label className="timer-session-note-wrap">
                <span>SESSION NOTE</span>
                <textarea
                  className="timer-session-note"
                  value={activeTimer.note || ''}
                  onChange={(event) => setActiveTimer((current) => current ? { ...current, note: event.target.value } : current)}
                  placeholder="Add a note about this session…"
                  maxLength={240}
                  rows={2}
                  aria-label="Session note to save with this entry"
                />
              </label>
            )}

            {/* Daily Summary Metrics Strip */}
            <div className="horology-metrics-strip">
              <div className="h-metric">
                <span className="h-metric-val">{fmtDur(todaySecs)}</span>
                <span className="h-metric-lbl">TODAY</span>
              </div>
              <div className="h-metric-divider" />
              <div className="h-metric">
                <span className="h-metric-val">{todaySessionsCount}</span>
                <span className="h-metric-lbl">SESSIONS</span>
              </div>
              <div className="h-metric-divider" />
              <div className="h-metric">
                <span className="h-metric-val">{goalPct}%</span>
                <span className="h-metric-lbl">DAILY GOAL</span>
              </div>
              <div className="h-metric-divider" />
              <div className="h-metric" title={`Average for ${sessionProject?.name || 'this project'}${sessionSubject?.name ? ` · ${sessionSubject.name}` : ''}`}>
                <span className="h-metric-val">{averageComboSeconds ? fmtDur(averageComboSeconds) : '—'}</span>
                <span className="h-metric-lbl">AVG SESSION</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SESSION HISTORY LIST ─────────────────────────── */}
      <TimerEntriesList entries={entries} setEntries={setEntries} projects={projects} onOpenCalendar={() => setCalendarOpen(true)} />
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
