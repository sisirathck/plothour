import React, { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Clock3, FolderKanban, Play, Square, Tag } from 'lucide-react';
import { TimerClock } from './TimerClock';
import { TimerEntriesList } from './TimerEntriesList';
import './Timer.css';

const PROJECTS_KEY = 'studyduel_demo_projects';
const ACTIVE_KEY = 'studyduel_demo_active_timer';
const ENTRIES_KEY = 'studyduel_demo_time_entries';

const readJson = (key, fallback) => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value ?? fallback;
  } catch {
    return fallback;
  }
};

const formatTime = (totalSeconds) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const formatDateTime = (value) => new Date(value).toLocaleString(undefined, {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
});

const localDateKey = (value) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const initialProjects = [
  {
    id: 'computer-science',
    name: 'Computer Science',
    color: '#f97316',
    subjects: [
      { id: 'algorithms', name: 'Algorithms', color: '#3b82f6' },
      { id: 'data-structures', name: 'Data Structures', color: '#8b5cf6' },
    ],
  },
  {
    id: 'languages',
    name: 'Languages',
    color: '#10b981',
    subjects: [
      { id: 'japanese', name: 'Japanese', color: '#eab308' },
    ],
  },
];

export const TimerPage = ({ onNavigate, user }) => {
  const projectsKey = user?.id ? `studyduel_user_${user.id}_projects` : PROJECTS_KEY;
  const activeKey = user?.id ? `studyduel_user_${user.id}_active_timer` : ACTIVE_KEY;
  const entriesKey = user?.id ? `studyduel_user_${user.id}_time_entries` : ENTRIES_KEY;

  const [projects, setProjects] = useState(() => readJson(projectsKey, initialProjects));
  const [activeTimer, setActiveTimer] = useState(() => readJson(activeKey, null));
  const [entries, setEntries] = useState(() => readJson(entriesKey, []));
  const [selectedProjectId, setSelectedProjectId] = useState(() => readJson(activeKey, null)?.projectId || (readJson(projectsKey, initialProjects)[0]?.id || ''));
  const [selectedSubjectId, setSelectedSubjectId] = useState(() => readJson(activeKey, null)?.subjectId || (readJson(projectsKey, initialProjects)[0]?.subjects?.[0]?.id || ''));
  const [now, setNow] = useState(() => Date.now());
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    const syncProjects = () => setProjects(readJson(projectsKey, initialProjects));
    window.addEventListener('storage', syncProjects);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('storage', syncProjects);
    };
  }, [projectsKey]);

  useEffect(() => {
    localStorage.setItem(activeKey, JSON.stringify(activeTimer));
  }, [activeKey, activeTimer]);

  useEffect(() => {
    localStorage.setItem(entriesKey, JSON.stringify(entries));
  }, [entriesKey, entries]);

  useEffect(() => {
    if (!selectedProjectId && projects.length) {
      setSelectedProjectId(projects[0].id);
      setSelectedSubjectId(projects[0].subjects?.[0]?.id || '');
    }
  }, [projects, selectedProjectId]);

  const activeProject = useMemo(
    () => projects.find((project) => project.id === (activeTimer?.projectId || selectedProjectId)),
    [projects, activeTimer, selectedProjectId]
  );

  const activeSubject = useMemo(
    () => activeProject?.subjects?.find((subject) => subject.id === (activeTimer?.subjectId || selectedSubjectId)),
    [activeProject, activeTimer, selectedSubjectId]
  );

  const elapsedSeconds = useMemo(() => {
    if (!activeTimer) return 0;
    return Math.max(0, Math.floor((now - activeTimer.startedAt) / 1000));
  }, [activeTimer, now]);

  const frequentCombinations = useMemo(() => {
    const counts = new Map();
    entries.forEach((entry) => {
      const key = `${entry.projectId}::${entry.subjectId || ''}`;
      const current = counts.get(key) || {
        projectId: entry.projectId,
        projectName: entry.projectName,
        subjectId: entry.subjectId || '',
        subjectName: entry.subjectName || '',
        color: entry.color,
        count: 0,
      };
      current.count += 1;
      counts.set(key, current);
    });
    return Array.from(counts.values()).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [entries]);

  const startTimer = (projectId = selectedProjectId, subjectId = selectedSubjectId) => {
    const project = projects.find((item) => item.id === projectId);
    if (!project) {
      setNotice('Choose or create a project before starting the timer.');
      return;
    }
    const subject = project.subjects?.find((item) => item.id === subjectId);
    const startedAt = Date.now();
    const nextTimer = {
      projectId: project.id,
      projectName: project.name,
      subjectId: subject?.id || '',
      subjectName: subject?.name || '',
      color: subject?.color || project.color || '#f97316',
      startedAt,
    };

    if (activeTimer) {
      const durationSeconds = Math.max(1, Math.floor((startedAt - activeTimer.startedAt) / 1000));
      const finishedEntry = {
        id: crypto.randomUUID(),
        ...activeTimer,
        endedAt: startedAt,
        durationSeconds,
      };
      setEntries((current) => [finishedEntry, ...current]);
      setNotice(`Switched timer to ${nextTimer.projectName}${nextTimer.subjectName ? ` - ${nextTimer.subjectName}` : ''}.`);
    } else {
      setNotice(`Tracking ${nextTimer.projectName}${nextTimer.subjectName ? ` - ${nextTimer.subjectName}` : ''}.`);
    }

    setActiveTimer(nextTimer);
    setSelectedProjectId(project.id);
    setSelectedSubjectId(subject?.id || '');
  };

  const stopTimer = () => {
    if (!activeTimer) return;
    const endedAt = Date.now();
    const durationSeconds = Math.max(1, Math.floor((endedAt - activeTimer.startedAt) / 1000));
    const finishedEntry = {
      id: crypto.randomUUID(),
      ...activeTimer,
      endedAt,
      durationSeconds,
    };
    setEntries((current) => [finishedEntry, ...current]);
    setActiveTimer(null);
    setNotice(`Saved ${finishedEntry.projectName}${finishedEntry.subjectName ? ` - ${finishedEntry.subjectName}` : ''} (${formatTime(durationSeconds)}).`);
  };

  const handleProjectSelect = (event) => {
    const nextProjectId = event.target.value;
    setSelectedProjectId(nextProjectId);
    const nextProject = projects.find((item) => item.id === nextProjectId);
    const nextSubjectId = nextProject?.subjects?.[0]?.id || '';
    setSelectedSubjectId(nextSubjectId);

    if (activeTimer && nextProjectId && (nextProjectId !== activeTimer.projectId || nextSubjectId !== (activeTimer.subjectId || ''))) {
      startTimer(nextProjectId, nextSubjectId);
    }
  };

  const handleSubjectSelect = (event) => {
    const nextSubjectId = event.target.value;
    setSelectedSubjectId(nextSubjectId);

    if (activeTimer && selectedProjectId && nextSubjectId !== (activeTimer.subjectId || '')) {
      startTimer(selectedProjectId, nextSubjectId);
    }
  };

  return (
    <div className="timer-module-container">
      {/* Current Clock Card */}
      <TimerClock />

      {/* Main Focus Timer Card */}
      <section className="timer-hero-card" aria-label="Timer panel">
        <div className="timer-top-row">
          <div className="timer-info-col">
            <span className="task-category-label">READY TO FOCUS</span>
            <h2 className="current-task-title">
              {activeTimer ? `Studying ${activeTimer.projectName}` : "Choose what you're studying"}
            </h2>
            <div className="task-tags">
              <span className="task-tag highlight">
                <Tag size={13} />
                <span>{activeProject?.name || 'No project selected'}</span>
              </span>
              <span className="task-tag">
                <FolderKanban size={13} />
                <span>{activeSubject?.name || 'No subject'}</span>
              </span>
            </div>

            <div className="timer-selectors">
              <label className="timer-select-field">
                <span>Project <b>*</b></span>
                <select value={selectedProjectId} onChange={handleProjectSelect} disabled={!projects.length}>
                  {projects.length === 0 ? (
                    <option value="">No projects available</option>
                  ) : (
                    projects.map((project) => (
                      <option key={project.id} value={project.id}>{project.name}</option>
                    ))
                  )}
                </select>
              </label>

              <label className="timer-select-field">
                <span>Subject <small>(optional)</small></span>
                <select value={selectedSubjectId} onChange={handleSubjectSelect} disabled={!activeProject?.subjects?.length}>
                  <option value="">No subject</option>
                  {activeProject?.subjects?.map((subject) => (
                    <option key={subject.id} value={subject.id}>{subject.name}</option>
                  ))}
                </select>
              </label>

              {!projects.length && (
                <p className="timer-manage-hint">
                  No projects yet. Add a project from the{' '}
                  <button type="button" className="inline-link-btn" onClick={() => onNavigate?.('manage')}>
                    <strong>Manage</strong>
                  </button>{' '}
                  tab first.
                </p>
              )}
            </div>
          </div>

          <div className="timer-display-box">
            <span className="timer-digits" aria-live="polite">{formatTime(elapsedSeconds)}</span>
            <span className="timer-label">ELAPSED TIME</span>
          </div>
        </div>

        {activeTimer && (
          <div className="timer-session-meta">
            <span><CalendarClock size={14} /> Started: {formatDateTime(activeTimer.startedAt)}</span>
            <span><Clock3 size={14} /> Active: {localDateKey(activeTimer.startedAt)}</span>
          </div>
        )}

        {notice && <p className="timer-notice">{notice}</p>}

        <div className="timer-actions-row">
          {activeTimer ? (
            <button type="button" className="timer-ctrl-btn primary pause" onClick={stopTimer}>
              <Square size={17} fill="currentColor" />
              <span>Stop timer</span>
            </button>
          ) : (
            <button type="button" className="timer-ctrl-btn primary start" onClick={() => startTimer()} disabled={!projects.length}>
              <Play size={17} fill="currentColor" />
              <span>Start timer</span>
            </button>
          )}

          <div className="timer-status-pulse">
            <span className={`pulse-dot ${activeTimer ? 'active' : ''}`} />
            <span className="status-text">{activeTimer ? 'Tracking live session' : 'No active session'}</span>
          </div>
        </div>
      </section>

      {/* Frequent Combinations Card */}
      <section className="demo-entry-card" aria-label="Frequent combinations">
        <div className="entries-panel-heading">
          <h3>Frequent combinations</h3>
          <span className="date-badge">Top {frequentCombinations.length || 5}</span>
        </div>
        {frequentCombinations.length === 0 ? (
          <p className="demo-entry-empty">Your most-used project and subject combinations will appear here after you complete sessions.</p>
        ) : (
          <div className="frequent-combination-list">
            {frequentCombinations.map((combo) => (
              <div key={`${combo.projectId}-${combo.subjectId}`} className="frequent-combination-row">
                <span className="demo-entry-color" style={{ backgroundColor: combo.color }} />
                <div className="demo-entry-name">
                  <strong>{combo.projectName}</strong>
                  <span>{combo.subjectName || 'No subject'}</span>
                </div>
                <span className="frequent-session-count">{combo.count} {combo.count === 1 ? 'session' : 'sessions'}</span>
                <button
                  type="button"
                  className="frequent-start-btn"
                  title="Start with this combination"
                  onClick={() => startTimer(combo.projectId, combo.subjectId)}
                >
                  <Play size={15} fill="currentColor" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Time Entries History */}
      <TimerEntriesList entries={entries} setEntries={setEntries} projects={projects} />
    </div>
  );
};
