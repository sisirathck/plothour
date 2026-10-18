import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Pencil, Save, Trash2, X } from 'lucide-react';

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

export const TimerEntriesList = ({ entries, setEntries, projects }) => {
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

  const startEdit = (entry) => {
    setEditingId(entry.id);
    setError('');
    setDraft({
      ...entry,
      startDate: localDateKey(entry.startedAt),
      startTime: localTimeKey(entry.startedAt),
      endDate: localDateKey(entry.endedAt),
      endTime: localTimeKey(entry.endedAt),
    });
  };

  const saveEdit = () => {
    if (!draft) return;
    const startedAt = new Date(`${draft.startDate}T${draft.startTime}`).getTime();
    const endedAt = new Date(`${draft.endDate}T${draft.endTime}`).getTime();
    if (Number.isNaN(startedAt) || Number.isNaN(endedAt) || startedAt >= endedAt) {
      setError('End time must be later than start time.');
      return;
    }
    const project = projects.find((item) => item.id === draft.projectId);
    const subject = project?.subjects?.find((item) => item.id === draft.subjectId);
    const updated = {
      ...draft,
      startedAt,
      endedAt,
      durationSeconds: Math.floor((endedAt - startedAt) / 1000),
      projectName: project?.name || draft.projectName,
      subjectName: subject?.name || '',
      color: subject?.color || project?.color || draft.color,
    };
    delete updated.startDate;
    delete updated.startTime;
    delete updated.endDate;
    delete updated.endTime;
    setEntries((items) => items.map((entry) => (entry.id === draft.id ? updated : entry)));
    setEditingId(null);
    setDraft(null);
    setError('');
  };

  const removeEntry = (id) => {
    if (!window.confirm('Delete this tracked session?')) return;
    setEntries((items) => items.filter((entry) => entry.id !== id));
  };

  return (
    <section className="demo-entry-card" aria-label="Completed time entries">
      <div className="entries-panel-heading">
        <button
          type="button"
          className="entries-collapse-btn"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
        >
          {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          <span>Session history</span>
          <span className="date-badge">{filteredEntries.length} {filteredEntries.length === 1 ? 'entry' : 'entries'}</span>
        </button>

        {expanded && (
          <div className="entries-controls">
            <label>
              <span>Range</span>
              <select value={range} onChange={(e) => { setRange(e.target.value); setPage(1); }}>
                <option value="today">Today</option>
                <option value="week">This week</option>
                <option value="month">This month</option>
                <option value="quarter">This quarter</option>
              </select>
            </label>
            <label>
              <span>Show</span>
              <select value={pageSize} onChange={(e) => { setPageSize(e.target.value); setPage(1); }}>
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="all">All</option>
              </select>
            </label>
          </div>
        )}
      </div>

      {expanded && (
        <>
          {filteredEntries.length === 0 ? (
            <p className="demo-entry-empty">No tracked time in this date range.</p>
          ) : (
            <div className="demo-entry-list">
              {visibleEntries.map((entry) => (
                <div key={entry.id} className="demo-entry-item">
                  <div className="demo-entry-row">
                    <span className="demo-entry-color" style={{ backgroundColor: entry.color }} />
                    <div className="demo-entry-name">
                      <strong>{entry.projectName}</strong>
                      <span>{entry.subjectName || 'No subject'}</span>
                    </div>
                    <div className="demo-entry-time">
                      <strong>{durationLabel(entry.durationSeconds)}</strong>
                      <span>{formatDateTime(entry.startedAt)} - {formatDateTime(entry.endedAt)}</span>
                    </div>
                    <span className="demo-entry-date">{localDateKey(entry.startedAt)}</span>
                    <div className="entry-row-actions">
                      <button type="button" onClick={() => startEdit(entry)} title="Edit"><Pencil size={15} /></button>
                      <button type="button" onClick={() => removeEntry(entry.id)} title="Delete"><Trash2 size={15} /></button>
                    </div>
                  </div>

                  {editingId === entry.id && draft && (
                    <form className="entry-edit-form" onSubmit={(e) => { e.preventDefault(); saveEdit(); }}>
                      <div className="entry-edit-grid">
                        <label>
                          <span>Project</span>
                          <select
                            value={draft.projectId}
                            onChange={(e) => {
                              const nextProject = projects.find((item) => item.id === e.target.value);
                              setDraft({
                                ...draft,
                                projectId: e.target.value,
                                projectName: nextProject?.name || '',
                                subjectId: '',
                                subjectName: '',
                                color: nextProject?.color || draft.color,
                              });
                            }}
                          >
                            {projects.map((project) => (
                              <option key={project.id} value={project.id}>{project.name}</option>
                            ))}
                          </select>
                        </label>

                        <label>
                          <span>Subject</span>
                          <select
                            value={draft.subjectId || ''}
                            onChange={(e) => {
                              const project = projects.find((item) => item.id === draft.projectId);
                              const subject = project?.subjects?.find((item) => item.id === e.target.value);
                              setDraft({
                                ...draft,
                                subjectId: e.target.value,
                                subjectName: subject?.name || '',
                                color: subject?.color || project?.color || draft.color,
                              });
                            }}
                          >
                            <option value="">No subject</option>
                            {projects.find((item) => item.id === draft.projectId)?.subjects?.map((subject) => (
                              <option key={subject.id} value={subject.id}>{subject.name}</option>
                            ))}
                          </select>
                        </label>

                        <label>
                          <span>Start</span>
                          <input type="date" value={draft.startDate} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} />
                          <input type="time" value={draft.startTime} onChange={(e) => setDraft({ ...draft, startTime: e.target.value })} />
                        </label>

                        <label>
                          <span>End</span>
                          <input type="date" value={draft.endDate} onChange={(e) => setDraft({ ...draft, endDate: e.target.value })} />
                          <input type="time" value={draft.endTime} onChange={(e) => setDraft({ ...draft, endTime: e.target.value })} />
                        </label>
                      </div>

                      {error && <p className="entries-error">{error}</p>}

                      <div className="entry-edit-actions">
                        <button type="submit" className="entry-save-btn"><Save size={14} /> Save</button>
                        <button type="button" className="entry-cancel-btn" onClick={() => { setEditingId(null); setDraft(null); setError(''); }}><X size={14} /> Cancel</button>
                      </div>
                    </form>
                  )}
                </div>
              ))}
            </div>
          )}

          {pageCount > 1 && (
            <div className="entries-footer">
              <span>Page {page} of {pageCount}</span>
              <div>
                <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}>Prev</button>
                <button type="button" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={page === pageCount}>Next</button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
};
