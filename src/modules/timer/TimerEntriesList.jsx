import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronLeft, ChevronRight, Pencil, Save, Trash2, X, Calendar, CalendarRange, Undo2 } from 'lucide-react';
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

const EditSelect = ({ value, options, onChange, label }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selected = options.find((option) => option.value === value) || options[0];
  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  return <div className="entry-edit-select" ref={rootRef}>
    <button type="button" className="entry-edit-select-trigger" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
      <span>{selected?.label || 'Select'}</span><ChevronDown size={14} aria-hidden="true" />
    </button>
    {open && <div className="entry-edit-select-menu" role="listbox" aria-label={label}>
      {options.map((option) => <button key={option.value || 'none'} type="button" role="option" aria-selected={option.value === value} className={option.value === value ? 'is-selected' : ''} onClick={() => { onChange(option.value); setOpen(false); }}>{option.label}</button>)}
    </div>}
  </div>;
};

const SessionDatePicker = ({ value, onChange }) => {
  const selected = new Date(`${value}T12:00:00`);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1));
  const rootRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = new Date(first);
  gridStart.setDate(1 - first.getDay());
  const days = Array.from({ length: 42 }, (_, index) => { const day = new Date(gridStart); day.setDate(gridStart.getDate() + index); return day; });
  return <div className="entry-date-picker" ref={rootRef}>
    <button type="button" className="entry-date-trigger" aria-haspopup="dialog" aria-expanded={open} onClick={() => { setMonth(new Date(selected.getFullYear(), selected.getMonth(), 1)); setOpen((current) => !current); }}>
      <span>{formatDisplayDate(selected, { day: '2-digit', month: 'short', year: 'numeric' })}</span><Calendar size={14} aria-hidden="true" />
    </button>
    {open && <div className="entry-date-popover" role="dialog" aria-label="Choose session date">
      <div className="entry-date-head"><button type="button" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={15} /></button><strong>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</strong><button type="button" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={15} /></button></div>
      <div className="entry-date-weekdays">{'SMTWTFS'.split('').map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div>
      <div className="entry-date-grid">{days.map((day) => { const key = localDateKey(day); return <button type="button" key={key} className={`${day.getMonth() !== month.getMonth() ? 'is-outside ' : ''}${key === value ? 'is-selected' : ''}`} onClick={() => { onChange(key); setOpen(false); }}>{day.getDate()}</button>; })}</div>
    </div>}
  </div>;
};

export const TimerEntriesList = ({ entries, setEntries, projects, user, selectedDate = null, hideRangeControls = false, hideProjectColors = false, onOpenCalendar }) => {
  const [expanded, setExpanded] = useState(hideRangeControls);
  const isExpanded = expanded;
  const [range, setRange] = useState('today');
  const [filterProjectId, setFilterProjectId] = useState('');
  const [filterSubjectId, setFilterSubjectId] = useState('');
  const [pageSize, setPageSize] = useState('20');
  const [page, setPage] = useState(1);
  const [undoAction, setUndoAction] = useState(null);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const deleteCancelRef = useRef(null);
  const deleteDialogRef = useRef(null);
  const deleteTriggerRef = useRef(null);
  const activityKey = user?.id ? `studyduel_user_${user.id}_session_activity` : 'studyduel_demo_session_activity';
  const [recentChanges, setRecentChanges] = useState(() => { try { const value = JSON.parse(localStorage.getItem(activityKey) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } });
  const undoTimerRef = useRef(null);
  const closeDeleteDialog = useCallback(() => {
    setPendingDeleteId(null);
    window.requestAnimationFrame(() => deleteTriggerRef.current?.focus());
  }, []);
  useEffect(() => () => window.clearTimeout(undoTimerRef.current), []);
  useEffect(() => {
    if (pendingDeleteId == null) return undefined;
    deleteCancelRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeDeleteDialog();
      } else if (event.key === 'Tab') {
        const controls = deleteDialogRef.current?.querySelectorAll('button:not(:disabled)');
        if (!controls?.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [pendingDeleteId, closeDeleteDialog]);
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
    if (day < dateRange.start || day > dateRange.end) return false;
    if (filterProjectId && entry.projectId !== filterProjectId) return false;
    if (filterSubjectId && entry.subjectId !== filterSubjectId) return false;
    return true;
  }), [entries, dateRange, filterProjectId, filterSubjectId]);

  const historyProjectOptions = useMemo(() => [
    { value: '', label: 'All projects' },
    ...projects.map((project) => ({ value: project.id, label: project.name })),
  ], [projects]);
  const historySubjectOptions = useMemo(() => {
    const source = filterProjectId
      ? projects.filter((project) => project.id === filterProjectId)
      : projects;
    return [
      { value: '', label: filterProjectId ? 'All subprojects' : 'All subprojects' },
      ...source.flatMap((project) => (project.subjects || []).map((subject) => ({
        value: subject.id,
        label: filterProjectId ? subject.name : `${project.name} · ${subject.name}`,
        projectId: project.id,
      }))),
    ];
  }, [projects, filterProjectId]);

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

  const requestDelete = (id, trigger) => {
    deleteTriggerRef.current = trigger;
    setPendingDeleteId(id);
  };

  const removeEntry = () => {
    const id = pendingDeleteId;
    if (id == null) return;
    const previousEntry = entries.find((entry) => entry.id === id);
    setEntries((items) => items.filter((entry) => entry.id !== id));
    if (previousEntry) { recordChange('Deleted', previousEntry); offerUndo('Session deleted', () => { setEntries((items) => items.some((entry) => entry.id === id) ? items : [...items, previousEntry].sort((a, b) => Number(b.startedAt) - Number(a.startedAt))); recordChange('Restored', previousEntry); }); }
    setPendingDeleteId(null);
  };

  const pendingDeleteEntry = entries.find((entry) => entry.id === pendingDeleteId);

  return (
    <section className={`demo-entry-card${isExpanded ? ' is-expanded' : ''}${!hideRangeControls ? ' can-toggle' : ''}`} aria-label="Completed time entries">
      {/* Panel Header */}
      <div
        className="entries-panel-heading"
        onClick={() => { if (!hideRangeControls) setExpanded((current) => !current); }}
        title={isExpanded ? 'Collapse session history' : 'Expand session history'}
      >
        <div className="entries-heading-label">
          <span className="entries-heading-title">SESSION HISTORY</span>
          <span className="date-badge">{filteredEntries.length} {filteredEntries.length === 1 ? 'session' : 'sessions'}</span>
        </div>
        {!hideRangeControls && (
          <div className="entries-heading-actions">
            {onOpenCalendar && (
              <button type="button" className="entries-calendar-btn" onClick={(event) => { event.stopPropagation(); onOpenCalendar(); }} aria-label="Open calendar view">
                <CalendarRange size={15} strokeWidth={1.7} /> Calendar view
              </button>
            )}
            <button
              type="button"
              className="entries-expand-toggle"
              onClick={(event) => { event.stopPropagation(); setExpanded((current) => !current); }}
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
            {!hideRangeControls && <div className="entries-history-filters" aria-label="Filter session history">
              <div className="entries-history-filter">
                <span>Project</span>
                <EditSelect
                  value={filterProjectId}
                  options={historyProjectOptions}
                  label="Filter by project"
                  onChange={(value) => { setFilterProjectId(value); setFilterSubjectId(''); setPage(1); }}
                />
              </div>
              <div className="entries-history-filter">
                <span>Subproject</span>
                <EditSelect
                  value={filterSubjectId}
                  options={historySubjectOptions}
                  label="Filter by subproject"
                  onChange={(value) => {
                    setFilterSubjectId(value);
                    const option = historySubjectOptions.find((item) => item.value === value);
                    if (option?.projectId) setFilterProjectId(option.projectId);
                    setPage(1);
                  }}
                />
              </div>
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
                        <button type="button" className="entry-action-btn delete" onClick={(event) => requestDelete(entry.id, event.currentTarget)} title="Delete session" aria-label={`Delete ${entry.projectName || 'study'} session`}>
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
                          <EditSelect
                            value={draft.projectId}
                            label="Project"
                            options={projects.map((project) => ({ value: project.id, label: project.name }))}
                            onChange={(value) => {
                              const nextProject = projects.find((item) => item.id === value);
                              setDraft({
                                ...draft,
                                projectId: value,
                                projectName: nextProject?.name || '',
                                subjectId: '',
                                subjectName: '',
                                color: nextProject?.color || draft.color,
                              });
                            }}
                          />
                        </div>

                        <div className="edit-field">
                          <label>Subject</label>
                          <EditSelect
                            value={draft.subjectId || ''}
                            label="Subject"
                            options={[{ value: '', label: 'No subject' }, ...(projects.find((item) => item.id === draft.projectId)?.subjects || []).map((subject) => ({ value: subject.id, label: subject.name }))]}
                            onChange={(value) => {
                              const project = projects.find((item) => item.id === draft.projectId);
                              const subject = project?.subjects?.find((item) => item.id === value);
                              setDraft({
                                ...draft,
                                subjectId: value,
                                subjectName: subject?.name || '',
                                color: subject?.color || project?.color || draft.color,
                              });
                            }}
                          />
                        </div>

                        <div className="edit-field">
                          <label>Date</label>
                          <SessionDatePicker
                            value={draft.startDate}
                            onChange={(value) => setDraft({ ...draft, startDate: value, endDate: value })}
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
      {pendingDeleteEntry && createPortal(
        <div className="entries-delete-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDeleteDialog(); }}>
          <section ref={deleteDialogRef} className="entries-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="entries-delete-title" aria-describedby="entries-delete-description">
            <button type="button" className="entries-delete-close" onClick={closeDeleteDialog} aria-label="Cancel delete">
              <X size={17} />
            </button>
            <span className="entries-delete-icon"><Trash2 size={18} /></span>
            <span className="entries-delete-eyebrow">SESSION HISTORY</span>
            <h2 id="entries-delete-title">Delete this session?</h2>
            <p className="entries-delete-session-name">{pendingDeleteEntry.projectName || 'Study session'}{pendingDeleteEntry.subjectName ? ` · ${pendingDeleteEntry.subjectName}` : ''}</p>
            <p id="entries-delete-description">This session will be removed from your history and study totals. You can undo the change right after deleting it.</p>
            <div className="entries-delete-actions">
              <button ref={deleteCancelRef} type="button" className="entries-delete-cancel" onClick={closeDeleteDialog}>Cancel</button>
              <button type="button" className="entries-delete-confirm" onClick={removeEntry}><Trash2 size={14} /> Delete session</button>
            </div>
          </section>
        </div>, document.body
      )}
    </section>
  );
};
