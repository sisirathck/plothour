import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Clock3, Plus, X } from 'lucide-react';
import { EditSelect, SessionDatePicker } from './TimerEntriesList';

const QUICK_TIMES = ['09:00', '12:00', '15:00', '18:00'];

const TimePicker = ({ name, label, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const hour = value ? value.slice(0, 2) : '';
  const minute = value ? value.slice(3, 5) : '';
  const updatePart = (part, next) => {
    const nextHour = part === 'hour' ? next : hour || '09';
    const nextMinute = part === 'minute' ? next : minute || '00';
    onChange(`${nextHour}:${nextMinute}`);
  };
  const display = value ? new Date(`2000-01-01T${value}`).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Choose a time';
  return <div className={`manual-time-picker${open ? ' is-open' : ''}`}>
    <input type="hidden" name={name} value={value} />
    <button type="button" className="manual-time-trigger" aria-haspopup="dialog" aria-expanded={open} aria-label={`${label}: ${value || 'choose a time'}`} onClick={() => setOpen(current => !current)}>
      <span className="manual-time-trigger-icon"><Clock3 size={16} /></span><span className={value ? '' : 'is-placeholder'}>{display}</span><ChevronDown size={15} />
    </button>
    {open && <div className="manual-time-popover" role="dialog" aria-label={`Choose ${label.toLowerCase()}`}>
      <div className="manual-time-popover-heading"><span>Choose {label.toLowerCase()}</span>{value && <span className="manual-time-selected"><Check size={12} /> Selected</span>}</div>
      <div className="manual-time-selects">
        <label>Hour<select aria-label={`${label} hour`} value={hour} onChange={event => updatePart('hour', event.target.value)}><option value="" disabled>HH</option>{Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0')).map(item => <option key={item} value={item}>{item}</option>)}</select></label>
        <span className="manual-time-colon">:</span>
        <label>Minute<select aria-label={`${label} minute`} value={minute} onChange={event => updatePart('minute', event.target.value)}><option value="" disabled>MM</option>{Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0')).map(item => <option key={item} value={item}>{item}</option>)}</select></label>
        <button type="button" className="manual-time-done" disabled={!value} onClick={() => setOpen(false)}>Done</button>
      </div>
      <div className="manual-time-quick-label">QUICK PICKS</div>
      <div className="manual-time-quick-picks">{QUICK_TIMES.map(item => <button type="button" key={item} className={value === item ? 'is-selected' : ''} onClick={() => { onChange(item); setOpen(false); }}>{item}</button>)}</div>
    </div>}
  </div>;
};

export const ManualEntry = ({ projects, onSave }) => {
  const dialog = useRef(null);
  const [projectId, setProject] = useState(projects[0]?.id || '');
  const [subjectId, setSubject] = useState('');
  const [date, setDate] = useState(() => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0,10); });
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [error, setError] = useState('');
  const project = projects.find(p => p.id === projectId);
  useEffect(() => { if (!projectId && projects.length) setProject(projects[0].id); }, [projects, projectId]);
  const submit = event => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const start = new Date(`${date}T${form.get('start')}`).getTime();
    const end = new Date(`${date}T${form.get('end')}`).getTime();
    if (!project || !Number.isFinite(start) || !Number.isFinite(end) || end <= start || end > Date.now()) { setError('Choose a project and a past session with an end time after its start time.'); return; }
    const subject = project.subjects?.find(s => s.id === subjectId);
    onSave({ id: crypto.randomUUID(), projectId, projectName: project.name, subjectId: subject?.id || '', subjectName: subject?.name || '', color: subject?.color || project.color, startedAt: start, endedAt: end, durationSeconds: Math.floor((end-start)/1000), mode: 'stopwatch', note: String(form.get('note') || '') });
    dialog.current.close(); setError(''); setStartTime(''); setEndTime('');
  };
  return <><button className="manual-entry-trigger" type="button" onClick={() => dialog.current.showModal()}><Plus size={13} /> Add entry</button>
    <dialog ref={dialog} className="manual-entry-dialog"><form onSubmit={submit}>
      <header><div><h2>Add missed session</h2><p>Record time you studied away from the timer.</p></div><button type="button" aria-label="Close" onClick={() => dialog.current.close()}><X size={18} /></button></header>
      <div className="manual-entry-fields">
        <label>Project<EditSelect label="Entry project" value={projectId} options={projects.map(p => ({ value:p.id,label:p.name }))} onChange={id => { setProject(id); setSubject(''); }} /></label>
        <label>Subproject<EditSelect label="Entry subproject" value={subjectId} options={[{value:'',label:'No subproject'},...(project?.subjects || []).map(s => ({value:s.id,label:s.name}))]} onChange={setSubject} /></label>
        <label>Date<SessionDatePicker value={date} onChange={setDate} /></label>
        <label>Start time<TimePicker name="start" label="Start time" value={startTime} onChange={setStartTime} /></label><label>End time<TimePicker name="end" label="End time" value={endTime} onChange={setEndTime} /></label>
        <label className="manual-entry-note">Session note<input name="note" maxLength={240} placeholder="What did you work on?" /></label>
      </div>{error && <p role="alert">{error}</p>}<footer><button type="button" onClick={() => dialog.current.close()}>Cancel</button><button className="entry-save-btn" type="submit">Save entry</button></footer>
    </form></dialog></>;
};
