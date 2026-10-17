import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Clock3, Pencil, Save, Trash2, X } from 'lucide-react';

const localDateKey = (value) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const localTimeKey = (value) => {
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

const formatDateTime = (value) => new Date(value).toLocaleString(undefined, {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
});

const getDateRange = (range, now = new Date()) => {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  if (range === 'week') {
    const daysFromMonday = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - daysFromMonday);
  } else if (range === 'month') {
    start.setDate(1);
  } else if (range === 'quarter') {
    start.setMonth(Math.floor(start.getMonth() / 3) * 3, 1);
  }
  return { start: localDateKey(start), end: localDateKey(end) };
};

const durationLabel = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
};

export const DemoEntriesPanel = ({ entries, setEntries, projects }) => {
  const [expanded, setExpanded] = useState(false);
  const [range, setRange] = useState('today');
  const [pageSize, setPageSize] = useState('20');
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState('');
  const [filterDate, setFilterDate] = useState(() => new Date());

  useEffect(() => {
    const interval = window.setInterval(() => setFilterDate(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const dateRange = useMemo(() => getDateRange(range, filterDate), [range, filterDate]);
  const filteredEntries = useMemo(() => entries.filter((entry) => {
    const day = localDateKey(entry.startedAt);
    return day >= dateRange.start && day <= dateRange.end;
  }), [entries, dateRange]);
  const effectivePageSize = pageSize === 'all' ? 100 : Number(pageSize);
  const pageCount = Math.max(1, Math.ceil(filteredEntries.length / effectivePageSize));
  const visibleEntries = filteredEntries.slice((page - 1) * effectivePageSize, page * effectivePageSize);

  const changeRange = (value) => { setRange(value); setPage(1); };
  const changePageSize = (value) => { setPageSize(value); setPage(1); };

  const beginEdit = (entry) => {
    setEditingId(entry.id);
    setDraft({
      projectId: entry.projectId,
      subjectId: entry.subjectId || '',
      startedDate: localDateKey(entry.startedAt),
      startedTime: localTimeKey(entry.startedAt),
      endedTime: localTimeKey(entry.endedAt),
    });
    setError('');
  };

  const saveEdit = (entry) => {
    const project = projects.find((item) => item.id === draft.projectId);
    const subject = project?.subjects.find((item) => item.id === draft.subjectId);
    const startedAt = new Date(`${draft.startedDate}T${draft.startedTime}`);
    const endedAt = new Date(`${draft.startedDate}T${draft.endedTime}`);
    if (draft.endedTime < draft.startedTime) endedAt.setDate(endedAt.getDate() + 1);
    if (!project) { setError('Select a project.'); return; }
    if (draft.subjectId && !subject) { setError('Select a valid subject for this project.'); return; }
    if (Number.isNaN(startedAt.getTime()) || Number.isNaN(endedAt.getTime()) || endedAt <= startedAt) {
      setError('End time must be after start time.');
      return;
    }
    setEntries((items) => items.map((item) => item.id === entry.id ? {
      ...item,
      projectId: project.id,
      projectName: project.name,
      projectColor: project.color,
      subjectId: subject?.id || null,
      subjectName: subject?.name || null,
      subjectColor: subject?.color || null,
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      date: localDateKey(startedAt),
      durationSeconds: Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000),
    } : item));
    setEditingId(null);
    setDraft(null);
    setError('');
  };

  const deleteEntry = (entry) => {
    if (!window.confirm(`Delete the ${entry.projectName} session from ${formatDateTime(entry.startedAt)}?`)) return;
    setEntries((items) => items.filter((item) => item.id !== entry.id));
    if (visibleEntries.length === 1 && page > 1) setPage((current) => current - 1);
  };

  return (
    <section className="demo-entry-card" aria-labelledby="demo-entries-title">
      <header className="entries-panel-heading">
        <button type="button" className="entries-collapse-btn" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} aria-controls="demo-entries-content">
          {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          <Clock3 className="section-icon" size={19} />
          <span id="demo-entries-title">Recent sessions</span>
          <span className="date-badge">{filteredEntries.length} entries</span>
        </button>
        {expanded && <div className="entries-controls">
          <label><span>Date range</span><select value={range} onChange={(event) => changeRange(event.target.value)}><option value="today">Today</option><option value="week">This week</option><option value="month">Month</option><option value="quarter">Quarter</option></select></label>
          <label><span>Per page</span><select value={pageSize} onChange={(event) => changePageSize(event.target.value)}><option value="20">20</option><option value="50">50</option><option value="100">100</option><option value="all">All (max 100)</option></select></label>
        </div>}
      </header>
      {expanded && <div id="demo-entries-content">
        {error && <p className="entries-error" role="alert">{error}</p>}
        {visibleEntries.length === 0 ? <p className="demo-entry-empty">No sessions for this date range.</p> : <div className="demo-entry-list">
          {visibleEntries.map((entry) => {
            const projectOptions = projects;
            const editProject = projects.find((item) => item.id === draft?.projectId);
            const currentProject = projects.find((item) => item.id === entry.projectId);
            const currentSubject = currentProject?.subjects.find((item) => item.id === entry.subjectId);
            const displayProjectName = currentProject?.name || entry.projectName;
            const displaySubjectName = currentSubject?.name || entry.subjectName;
            const displayProjectColor = currentProject?.color || entry.projectColor;
            return <article className="demo-entry-item" key={entry.id}>
              {editingId === entry.id && draft ? <div className="entry-edit-form">
                <div className="entry-edit-grid">
                  <label><span>Project</span><select value={draft.projectId} onChange={(event) => setDraft((item) => ({ ...item, projectId: event.target.value, subjectId: '' }))}><option value="">Select project</option>{projectOptions.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
                  <label><span>Subject (optional)</span><select value={draft.subjectId} onChange={(event) => setDraft((item) => ({ ...item, subjectId: event.target.value }))} disabled={!editProject}><option value="">No subject</option>{editProject?.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
                  <label><span>Start date</span><input type="date" value={draft.startedDate} onChange={(event) => setDraft((item) => ({ ...item, startedDate: event.target.value }))} /></label>
                  <label><span>Start time</span><input type="time" value={draft.startedTime} onChange={(event) => setDraft((item) => ({ ...item, startedTime: event.target.value }))} /></label>
                  <label><span>End time</span><input type="time" value={draft.endedTime} onChange={(event) => setDraft((item) => ({ ...item, endedTime: event.target.value }))} /></label>
                </div>
                <div className="entry-edit-actions"><button type="button" className="entry-save-btn" onClick={() => saveEdit(entry)}><Save size={14} /> Save changes</button><button type="button" className="entry-cancel-btn" onClick={() => { setEditingId(null); setDraft(null); setError(''); }}><X size={14} /> Cancel</button></div>
              </div> : <div className="demo-entry-row">
                <span className="demo-entry-color" style={{ backgroundColor: displayProjectColor }} />
                <div className="demo-entry-name"><strong>{displayProjectName}</strong><span>{displaySubjectName || 'No subject'}</span></div>
                <div className="demo-entry-time"><strong>{durationLabel(entry.durationSeconds)}</strong><span>{formatDateTime(entry.startedAt)} – {new Date(entry.endedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true })}</span></div>
                <time className="demo-entry-date">{new Date(`${entry.date}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</time>
                <div className="entry-row-actions"><button type="button" onClick={() => beginEdit(entry)} aria-label={`Edit ${entry.projectName} session`} title="Edit session"><Pencil size={15} /></button><button type="button" onClick={() => deleteEntry(entry)} aria-label={`Delete ${entry.projectName} session`} title="Delete session"><Trash2 size={15} /></button></div>
              </div>}
            </article>;
          })}
        </div>}
        <footer className="entries-footer">
          <span>Showing {filteredEntries.length ? (page - 1) * effectivePageSize + 1 : 0}–{Math.min(page * effectivePageSize, filteredEntries.length)} of {filteredEntries.length}</span>
          <div><button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button><span>Page {page} of {pageCount}</span><button type="button" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)}>Next</button></div>
        </footer>
        <p className="demo-storage-caption">Guest demo entries are stored locally in this browser, not sent to the database.</p>
      </div>}
    </section>
  );
};
