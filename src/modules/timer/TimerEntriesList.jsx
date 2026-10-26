import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Pencil, Save, Trash2, X, Calendar, CalendarDays, Undo2 } from 'lucide-react';
import { formatDisplayDate } from '../../utils/dateFormat';

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
  return formatDisplayDate(d, { month: 'short', day: 'numeric' });
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

export const TimerEntriesList = ({ entries, setEntries, projects, user, selectedDate = null, hideRangeControls = false, hideProjectColors = false, onOpenCalendar }) => {
  const [expanded, setExpanded] = useState(hideRangeControls);
  const isExpanded = expanded;
  const [range, setRange] = useState('today');
  const [pageSize, setPageSize] = useState('20');
  const [page, setPage] = useState(1);
  const [undoAction, setUndoAction] = useState(null);
  const activityKey = user?.id ? `studyduel_user_${user.id}_session_activity` : 'studyduel_demo_session_activity';
  const [recentChanges, setRecentChanges] = useState(() => { try { const value = JSON.parse(localStorage.getItem(activityKey) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } });
  const undoTimerRef = useRef(null);
  useEffect(() => () => window.clearTimeout(undoTimerRef.current), []);
  const offerUndo = (message, undo) => {
    window.clearTimeout(undoTimerRef.current);
    setUndoAction({ message, undo });
    undoTimerRef.current = window.setTimeout(() => setUndoAction(null), 6000);
  };
  const recordChange = (action, entry) => {
    const item = { id: `${Date.now()}-${entry.id}`, action, project: entry.projectName || 'General study', at: Date.now() };
    setRecentChanges((current) => { const next = [item, ...current].slice(0, 5); try { localStorage.setItem(activityKey, JSON.stringify(next)); } catch {} return next; });
  };
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const cancelDeleteRef = useRef(null);
  const [filterDate, setFilterDate] = useState(() => new Date());

  useEffect(() => {
    if (!deleteTarget) return undefined;
    cancelDeleteRef.current?.focus();
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setDeleteTarget(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [deleteTarget]);

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

  const effectivePageSize = Math.max(1, Math.min(100, hideRangeControls ? filteredEntries.length : Number(pageSize)));
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
    const previousEntry = entries.find((entry) => entry.id === draft.id);
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
    if (previousEntry) { recordChange('Edited', previousEntry); offerUndo('Session updated', () => { setEntries((items) => items.map((entry) => entry.id === previousEntry.id ? previousEntry : entry)); recordChange('Restored', previousEntry); }); }
  };

  const removeEntry = (id) => {
    setDeleteTarget(entries.find((entry) => entry.id === id) || null);
  };

  const confirmRemoveEntry = () => {
    if (!deleteTarget) return;
    const previousEntry = deleteTarget;
    const id = previousEntry.id;
    setEntries((items) => items.filter((entry) => entry.id !== id));
    if (previousEntry) { recordChange('Deleted', previousEntry); offerUndo('Session deleted', () => { setEntries((items) => items.some((entry) => entry.id === id) ? items : [...items, previousEntry].sort((a, b) => Number(b.startedAt) - Number(a.startedAt))); recordChange('Restored', previousEntry); }); }
    setDeleteTarget(null);
  };

  return (
    <section className={`demo-entry-card${isExpanded ? ' is-expanded' : ''}`} aria-label="Completed time entries">
      {/* Panel Header */}
      <div className="entries-panel-heading">
        <div className="entries-heading-label">
          <span className="entries-heading-title">SESSION HISTORY</span>
          <span className="date-badge">{filteredEntries.length} {filteredEntries.length === 1 ? 'session' : 'sessions'}</span>
        </div>
        {!hideRangeControls && (
          <div className="entries-heading-actions">
            {onOpenCalendar && (
              <button type="button" className="entries-calendar-btn" onClick={onOpenCalendar} aria-label="Open calendar view">
                <CalendarDays size={15} /> Calendar view
              </button>
            )}
            <button
              type="button"
              className="entries-expand-toggle"
              onClick={() => setExpanded((current) => !current)}
              aria-expanded={isExpanded}
              aria-label={isExpanded ? 'Collapse session history' : 'Expand session history'}
            >
              <ChevronDown size={16} className={`entries-heading-chevron${isExpanded ? ' is-open' : ''}`} />
            </button>
          </div>
        )}
      </div>
      <div className="entries-expand-region" aria-hidden={!isExpanded}>
        <div className="entries-expand-inner" inert={!isExpanded}>
          <div className="entries-controls">
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
                aria-label="Sessions per page"
              >
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>}
          </div>
      {undoAction && <div className="entries-undo-toast" role="status"><span>{undoAction.message}</span><button type="button" onClick={() => { undoAction.undo(); setUndoAction(null); window.clearTimeout(undoTimerRef.current); }}><Undo2 size={14} /> Undo</button></div>}
      {recentChanges.length > 0 && <details className="entries-recent-changes"><summary>Recent changes <span>{recentChanges.length}</span></summary><ul>{recentChanges.map((item) => <li key={item.id}><strong>{item.action}</strong><span>{item.project}</span><time>{new Date(item.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</time></li>)}</ul></details>}

      {/* Expanded Content */}
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
                      {!hideProjectColors && <span className="demo-entry-color" style={{ backgroundColor: entry.color || 'var(--sd-coral)' }} />}
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
        </div>
      </div>
      {deleteTarget && createPortal(
        <div className="entries-delete-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDeleteTarget(null); }}>
          <section className="entries-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="entries-delete-title" aria-describedby="entries-delete-description">
            <span className="entries-delete-icon"><Trash2 size={18} /></span>
            <div className="entries-delete-copy">
              <span className="entries-delete-eyebrow">SESSION HISTORY</span>
              <h2 id="entries-delete-title">Delete this session?</h2>
              <p id="entries-delete-description">Remove the {deleteTarget.projectName || 'study'} session from your history? You can undo this for a few seconds after deleting.</p>
            </div>
            <div className="entries-delete-actions">
              <button ref={cancelDeleteRef} type="button" className="entries-delete-cancel" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button type="button" className="entries-delete-confirm" onClick={confirmRemoveEntry}><Trash2 size={14} /> Delete session</button>
            </div>
          </section>
        </div>,
        document.body
      )}
    </section>
  );
};
