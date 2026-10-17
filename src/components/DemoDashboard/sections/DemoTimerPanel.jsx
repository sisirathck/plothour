import React, { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Clock3, FolderKanban, Play, Square, Tag } from 'lucide-react';
import { DemoEntriesPanel } from './DemoEntriesPanel';

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

export const DemoTimerPanel = () => {
  const [projects, setProjects] = useState(() => readJson(PROJECTS_KEY, []));
  const [activeTimer, setActiveTimer] = useState(() => readJson(ACTIVE_KEY, null));
  const [entries, setEntries] = useState(() => readJson(ENTRIES_KEY, []));
  const [selectedProjectId, setSelectedProjectId] = useState(() => readJson(ACTIVE_KEY, null)?.projectId || '');
  const [selectedSubjectId, setSelectedSubjectId] = useState(() => readJson(ACTIVE_KEY, null)?.subjectId || '');
  const [now, setNow] = useState(Date.now());
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    const syncProjects = () => setProjects(readJson(PROJECTS_KEY, []));
    window.addEventListener('storage', syncProjects);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('storage', syncProjects);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(ACTIVE_KEY, JSON.stringify(activeTimer));
  }, [activeTimer]);

  useEffect(() => {
    localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
  }, [entries]);

  const selectedProject = projects.find((project) => project.id === (activeTimer?.projectId || selectedProjectId));
  const activeSubjects = selectedProject?.subjects || [];
  const selectedSubject = activeSubjects.find((subject) => subject.id === (activeTimer?.subjectId || selectedSubjectId));
  const elapsed = useMemo(() => activeTimer ? Math.max(0, Math.floor((now - new Date(activeTimer.startedAt).getTime()) / 1000)) : 0, [activeTimer, now]);
  const activeProject = activeTimer && projects.find((project) => project.id === activeTimer.projectId);
  const activeSubproject = activeTimer && activeProject?.subjects.find((subject) => subject.id === activeTimer.subjectId);
  const frequentCombinations = useMemo(() => {
    const counts = new Map();
    entries.forEach((entry) => {
      const project = projects.find((item) => item.id === entry.projectId);
      if (!project) return;
      const subject = entry.subjectId ? project.subjects.find((item) => item.id === entry.subjectId) : null;
      if (entry.subjectId && !subject) return;
      const key = `${project.id}::${subject?.id || ''}`;
      const existing = counts.get(key);
      counts.set(key, {
        key,
        projectId: project.id,
        projectName: project.name,
        projectColor: project.color,
        subjectId: subject?.id || null,
        subjectName: subject?.name || null,
        count: (existing?.count || 0) + 1,
      });
    });
    return [...counts.values()].sort((a, b) => b.count - a.count || a.projectName.localeCompare(b.projectName)).slice(0, 5);
  }, [entries, projects]);

  const startTimer = (projectId = selectedProjectId, subjectId = selectedSubjectId) => {
    const project = projects.find((item) => item.id === projectId);
    if (!project) {
      setNotice('Add a project in Manage, then select it to start tracking.');
      return;
    }
    const subject = project.subjects.find((item) => item.id === subjectId);
    const session = {
      id: crypto.randomUUID(),
      projectId: project.id,
      projectName: project.name,
      projectColor: project.color,
      subjectId: subject?.id || null,
      subjectName: subject?.name || null,
      subjectColor: subject?.color || null,
      startedAt: new Date().toISOString(),
    };
    setActiveTimer(session);
    setSelectedProjectId(project.id);
    setSelectedSubjectId(subject?.id || '');
    setNotice('Session started. End it to save the completed entry in this demo.');
  };

  const endTimer = () => {
    if (!activeTimer) return;
    const endedAt = new Date().toISOString();
    const completedEntry = {
      ...activeTimer,
      endedAt,
      date: localDateKey(activeTimer.startedAt),
      durationSeconds: Math.max(1, Math.floor((new Date(endedAt).getTime() - new Date(activeTimer.startedAt).getTime()) / 1000)),
    };
    setEntries((items) => [completedEntry, ...items]);
    setSelectedProjectId(activeTimer.projectId);
    setSelectedSubjectId(activeTimer.subjectId || '');
    setActiveTimer(null);
    setNotice('Session saved in this browser. Database saving is not connected in the guest demo.');
  };

  return (
    <>
      <section className="timer-hero-card" aria-labelledby="demo-timer-title">
        <div className="timer-top-row">
          <div className="current-task-info">
            <span className="task-category-label">{activeTimer ? 'CURRENT STUDY SPRINT' : 'READY TO FOCUS'}</span>
            <h2 id="demo-timer-title" className="current-task-title">
              {activeTimer ? `${activeTimer.projectName}${activeTimer.subjectName ? ` · ${activeTimer.subjectName}` : ''}` : 'Choose what you’re studying'}
            </h2>
            {activeTimer ? <div className="task-tags">
              <span className="task-tag"><FolderKanban size={12} /> {activeTimer.projectName}</span>
              {activeTimer.subjectName && <span className="task-tag"><Tag size={12} /> {activeTimer.subjectName}</span>}
            </div> : <div className="timer-selectors">
              <label className="timer-select-field">
                <span>Project <b aria-hidden="true">*</b></span>
                <select value={selectedProjectId} onChange={(event) => { setSelectedProjectId(event.target.value); setSelectedSubjectId(''); setNotice(''); }}>
                  <option value="">Select a project</option>
                  {projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}
                </select>
              </label>
              <label className="timer-select-field">
                <span>Subject <small>(optional)</small></span>
                <select value={selectedSubjectId} disabled={!selectedProjectId || activeSubjects.length === 0} onChange={(event) => { setSelectedSubjectId(event.target.value); setNotice(''); }}>
                  <option value="">No subject</option>
                  {activeSubjects.map((subject) => <option value={subject.id} key={subject.id}>{subject.name}</option>)}
                </select>
              </label>
              {projects.length === 0 && <p className="timer-manage-hint">No projects yet. Add a project from the <strong>Manage</strong> tab first.</p>}
            </div>}
          </div>

          <div className="timer-display-box" aria-live="off">
            <span className="timer-digits">{formatTime(elapsed)}</span>
            <span className="timer-label">ELAPSED TIME</span>
          </div>
        </div>

        {activeTimer && <div className="timer-session-meta">
          <span><CalendarClock size={15} /> Started {formatDateTime(activeTimer.startedAt)}</span>
          <span><Clock3 size={15} /> {activeProject?.name || activeTimer.projectName}{activeSubproject ? ` / ${activeSubproject.name}` : ''}</span>
        </div>}

        <div className="timer-actions-row">
          {!activeTimer ? <button type="button" className="timer-ctrl-btn primary start" onClick={() => startTimer()}>
            <Play size={17} /><span>Start timer</span>
          </button> : <button type="button" className="timer-ctrl-btn primary pause" onClick={endTimer}>
            <Square size={16} /><span>End session</span>
          </button>}
          <div className="timer-status-pulse">
            <span className={`pulse-dot ${activeTimer ? 'active' : ''}`} />
            <span className="status-text">{activeTimer ? 'Session running' : 'No active session'}</span>
          </div>
        </div>
        {notice && <p className="timer-notice" role="status">{notice}</p>}
      </section>

      <section className="demo-entry-card" aria-labelledby="demo-entries-title">
        <div className="section-header"><div className="header-title-group"><Clock3 className="section-icon" size={19} /><h3 id="demo-frequent-title">Frequent combinations</h3></div><span className="date-badge">Top 5</span></div>
        {frequentCombinations.length === 0 ? <p className="demo-entry-empty">Your most-used project and subject combinations will appear here after you complete sessions.</p> : <div className="frequent-combination-list">
          {frequentCombinations.map((combination) => <div className="frequent-combination-row" key={combination.key}>
            <span className="demo-entry-color" style={{ backgroundColor: combination.projectColor }} />
            <div className="demo-entry-name"><strong>{combination.projectName}</strong><span>{combination.subjectName || 'No subject'}</span></div>
            <span className="frequent-session-count">{combination.count} {combination.count === 1 ? 'session' : 'sessions'}</span>
            <button type="button" className="frequent-start-btn" onClick={() => startTimer(combination.projectId, combination.subjectId || '')} disabled={Boolean(activeTimer)} aria-label={`Start ${combination.projectName}${combination.subjectName ? `, ${combination.subjectName}` : ''}`} title={activeTimer ? 'End the running session first' : 'Start timer'}><Play size={16} fill="currentColor" /></button>
          </div>)}
        </div>}
      </section>

      <DemoEntriesPanel entries={entries} setEntries={setEntries} projects={projects} />
    </>
  );
};
