import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Pencil, Save, Trash2, X, Calendar, CalendarDays } from 'lucide-react';

const localDateKey = (value) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const localTimeKey = (value) => {
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

const formatTimeRange = (startVal, endVal) => {
  const s = new Date(startVal);
  const e = new Date(endVal);
  const sStr = s.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
  const eStr = e.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${sStr} – ${eStr}`;
};

const formatShortDate = (val) => {
  const d = new Date(val);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const getDateRange = (range, now = new Date()) => {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  if (range === 'week') {
    start.setDate(start.getDate() - start.getDay());
  } else if (range === 'month') {
    start.setDate(1);
  } else if (range === 'quarter') {
    start.setMonth(Math.floor(start.getMonth() / 3) * 3, 1);
  }
  return { start: localDateKey(start), end: localDateKey(end) };
};

const durationLabel = (seconds) => {
  if (seconds > 0 && seconds < 60) return `${Math.floor(seconds)}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
};

export const TimerEntriesList = ({ entries, setEntries, projects, selectedDate = null, hideRangeControls = false, onOpenCalendar }) => {
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

  const dateRange = useMemo(() => selectedDate
    ? { start: localDateKey(selectedDate), end: localDateKey(selectedDate) }
    : getDateRange(range, filterDate), [range, filterDate, selectedDate]);
  const filteredEntries = useMemo(() => entries.filter((entry) => {
    const day = localDateKey(entry.startedAt);
    return day >= dateRange.start && day <= dateRange.end;
  }), [entries, dateRange]);

  const effectivePageSize = hideRangeControls || pageSize === 'all' ? Math.max(1, filteredEntries.length) : Number(pageSize);
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

    const durationSeconds = Math.max(1, Math.floor((endedAt - startedAt) / 1000));
    setEntries((items) => items.map((entry) => {
      if (entry.id !== draft.id) return entry;
      return {
        ...entry,
        projectId: draft.projectId,
        projectName: draft.projectName,
        subjectId: draft.subjectId,
        subjectName: draft.subjectName,
        color: draft.color,
        startedAt,
        endedAt,
        durationSeconds,
        note: draft.note,
      };
    }));

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
      {/* Panel Header */}
      <div className="entries-panel-heading">
        <button
          type="button"
          className="entries-collapse-btn"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
        >
          <span className="entries-caret-icon">
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </span>
          <span className="entries-heading-title">SESSION HISTORY</span>
          <span className="date-badge">
            {filteredEntries.length} {filteredEntries.length === 1 ? 'session' : 'sessions'}
          </span>
        </button>

        {expanded && (
          <div className="entries-controls">
            {!hideRangeControls && onOpenCalendar && (
              <button type="button" className="entries-calendar-btn" onClick={() => {
                onOpenCalendar();
              }}>
                <CalendarDays size={15} /> Calendar view
              </button>
            )}
            {/* Segmented Range Buttons */}
            {!hideRangeControls && <div className="entries-range-pills" role="radiogroup" aria-label="Date range">
              {[
                { id: 'today', label: 'Today' },
                { id: 'week', label: 'Week' },
                { id: 'month', label: 'Month' },
                { id: 'quarter', label: 'Quarter' },
              ].map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={`range-pill-btn${range === r.id ? ' sel' : ''}`}
                  onClick={() => { setRange(r.id); setPage(1); }}
                >
                  {r.label}
                </button>
              ))}
            </div>}

            {/* Page Size */}
            {!hideRangeControls && <div className="entries-size-picker">
              <span className="size-picker-lbl">Show</span>
              <select
                className="entries-native-select"
                value={pageSize}
                onChange={(e) => { setPageSize(e.target.value); setPage(1); }}
              >
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="all">All</option>
              </select>
            </div>}
          </div>
        )}
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="entries-content-body">
          {filteredEntries.length === 0 ? (
            <div className="demo-entry-empty">
              <Calendar size={20} className="empty-icon" />
              <p>No tracked sessions found in this date range.</p>
            </div>
          ) : (
            <div className="demo-entry-list">
              {visibleEntries.map((entry) => (
                <div key={entry.id} className="demo-entry-item">
                  <div className="demo-entry-row">
                    {/* Left: Project & Subject */}
                    <div className="demo-entry-left">
                      <span className="demo-entry-color" style={{ backgroundColor: entry.color || 'var(--sd-coral)' }} />
                      <div className="demo-entry-name">
                        <strong className="entry-proj-title">{entry.projectName}</strong>
                        <span className="entry-sub-title">{entry.subjectName || 'No subject'}</span>
                        {entry.note && <span className="entry-note-tag">"{entry.note}"</span>}
                      </div>
                    </div>

                    {/* Center: Timestamp range */}
                    <div className="demo-entry-time">
                      <span className="entry-range-clock">{formatTimeRange(entry.startedAt, entry.endedAt)}</span>
                      <span className="demo-entry-date">{formatShortDate(entry.startedAt)}</span>
                    </div>

                    {/* Right: Duration badge & actions */}
                    <div className="demo-entry-right">
                      <span className="entry-duration-pill">{durationLabel(entry.durationSeconds)}</span>
                      <div className="entry-row-actions">
                        <button type="button" className="entry-action-btn" onClick={() => startEdit(entry)} title="Edit session">
                          <Pencil size={13} />
                        </button>
                        <button type="button" className="entry-action-btn delete" onClick={() => removeEntry(entry.id)} title="Delete session">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Inline Edit Form */}
                  {editingId === entry.id && draft && (
                    <form className="entry-edit-form" onSubmit={(e) => { e.preventDefault(); saveEdit(); }}>
                      <div className="entry-edit-grid">
                        <div className="edit-field">
                          <label>Project</label>
                          <select
                            className="edit-select"
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
                        </div>

                        <div className="edit-field">
                          <label>Subject</label>
                          <select
                            className="edit-select"
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
                        </div>

                        <div className="edit-field">
                          <label>Date</label>
                          <input
                            type="date"
                            className="edit-input"
                            value={draft.startDate}
                            onChange={(e) => setDraft({ ...draft, startDate: e.target.value, endDate: e.target.value })}
                          />
                        </div>

                        <div className="edit-field">
                          <label>Start & End Time</label>
                          <div className="edit-time-inputs">
                            <input
                              type="time"
                              className="edit-input time"
                              value={draft.startTime}
                              onChange={(e) => setDraft({ ...draft, startTime: e.target.value })}
                            />
                            <span className="time-sep">to</span>
                            <input
                              type="time"
                              className="edit-input time"
                              value={draft.endTime}
                              onChange={(e) => setDraft({ ...draft, endTime: e.target.value })}
                            />
                          </div>
                        </div>
                        <div className="edit-field edit-field-wide">
                          <label>Session outcome (optional)</label>
                          <input
                            type="text"
                            className="edit-input"
                            value={draft.note || ''}
                            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                            placeholder="What did you finish? e.g. solved 8 practice problems"
                            maxLength={240}
                          />
                        </div>
                      </div>

                      {error && <p className="entries-error">{error}</p>}

                      <div className="entry-edit-actions">
                        <button type="submit" className="entry-save-btn">
                          <Save size={13} /> Save Changes
                        </button>
                        <button
                          type="button"
                          className="entry-cancel-btn"
                          onClick={() => { setEditingId(null); setDraft(null); setError(''); }}
                        >
                          <X size={13} /> Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              ))}
            </div>
          )}

          {pageCount > 1 && (
            <div className="entries-footer">
              <span className="entries-page-indicator">Page {page} of {pageCount}</span>
              <div className="entries-pagination-btns">
                <button
                  type="button"
                  className="page-nav-btn"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page === 1}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="page-nav-btn"
                  onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                  disabled={page === pageCount}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
