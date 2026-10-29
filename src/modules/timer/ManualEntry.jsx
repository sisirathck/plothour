import React, { useEffect, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { EditSelect, SessionDatePicker } from './TimerEntriesList';

export const ManualEntry = ({ projects, onSave }) => {
  const dialog = useRef(null);
  const [projectId, setProject] = useState(projects[0]?.id || '');
  const [subjectId, setSubject] = useState('');
  const [date, setDate] = useState(() => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0,10); });
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
    dialog.current.close(); setError('');
  };
  return <><button className="manual-entry-trigger" type="button" onClick={() => dialog.current.showModal()}><Plus size={13} /> Add entry</button>
    <dialog ref={dialog} className="manual-entry-dialog"><form onSubmit={submit}>
      <header><div><h2>Add missed session</h2><p>Record time you studied away from the timer.</p></div><button type="button" aria-label="Close" onClick={() => dialog.current.close()}><X size={18} /></button></header>
      <div className="manual-entry-fields">
        <label>Project<EditSelect label="Entry project" value={projectId} options={projects.map(p => ({ value:p.id,label:p.name }))} onChange={id => { setProject(id); setSubject(''); }} /></label>
        <label>Subproject<EditSelect label="Entry subproject" value={subjectId} options={[{value:'',label:'No subproject'},...(project?.subjects || []).map(s => ({value:s.id,label:s.name}))]} onChange={setSubject} /></label>
        <label>Date<SessionDatePicker value={date} onChange={setDate} /></label>
        <label>Start time<input required type="time" name="start" /></label><label>End time<input required type="time" name="end" /></label>
        <label className="manual-entry-note">Session note<input name="note" maxLength={240} placeholder="What did you work on?" /></label>
      </div>{error && <p role="alert">{error}</p>}<footer><button type="button" onClick={() => dialog.current.close()}>Cancel</button><button className="entry-save-btn" type="submit">Save entry</button></footer>
    </form></dialog></>;
};
