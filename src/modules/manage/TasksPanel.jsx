import React, { useEffect, useState } from 'react';
import './TasksPanel.css';
import { CalendarDays, ArrowUpRight, Check, Clock3 } from 'lucide-react';
import { EditSelect, SessionDatePicker } from '../timer/TimerEntriesList';

const dateKey = (date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const demoTasks = () => {
  const day = (offset) => { const date = new Date(); date.setDate(date.getDate() + offset); return dateKey(date); };
  return [
    { id: 'demo-task-1', title: 'Submit graph algorithms assignment', project_name: 'Computer Science', due_date: day(0), reminder_date: day(0), completed: false },
    { id: 'demo-task-2', title: 'Finish statistics problem set', project_name: 'Mathematics', due_date: day(1), reminder_date: day(0), completed: false },
    { id: 'demo-task-3', title: 'Prepare capstone prototype', project_name: 'Portfolio Capstone', due_date: day(3), completed: false },
    { id: 'demo-task-4', title: 'Review vocabulary flashcards', project_name: 'Japanese', due_date: day(-1), completed: false },
  ];
};
const readDemoTasks = () => { try { return JSON.parse(sessionStorage.getItem('plothour_demo_tasks')) || demoTasks(); } catch { return demoTasks(); } };

export function useTasks(user) {
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState('');
  const load = async () => {
    if (!user?.id) { setTasks(readDemoTasks()); return; }
    try { const response = await fetch('/api/tasks'); if (!response.ok) throw new Error('Could not load tasks'); setTasks(await response.json()); setError(''); }
    catch (e) { setError(e.message); }
  };
  useEffect(() => { setTasks([]); load(); window.addEventListener('tasks-changed', load); return () => window.removeEventListener('tasks-changed', load); }, [user?.id]);
  const mutate = async (path, method, body) => {
    try {
      if (!user?.id) {
        const current = readDemoTasks(); const id = path.slice(1);
        const next = method === 'POST' ? [{ ...body, id: crypto.randomUUID(), completed: false }, ...current]
          : method === 'DELETE' ? current.filter(task => task.id !== id)
            : current.map(task => task.id === id ? { ...task, ...body } : task);
        sessionStorage.setItem('plothour_demo_tasks', JSON.stringify(next));
        window.dispatchEvent(new Event('tasks-changed')); return true;
      }
      const response = await fetch(`/api/tasks${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
      if (!response.ok) throw new Error('Could not save task. Please retry.');
      window.dispatchEvent(new Event('tasks-changed')); setError(''); return true;
    } catch (e) { setError(e.message); return false; }
  };
  return { tasks, error, mutate };
}

export const TasksPanel = ({ user, projects }) => {
  const { tasks, error, mutate } = useTasks(user);
  const [busy, setBusy] = useState(false);
  const [project, setProject] = useState('');
  const [due, setDue] = useState('');
  const [reminder, setReminder] = useState('');
  const add = async (event) => {
    event.preventDefault(); const form = event.currentTarget;
    const body = { ...Object.fromEntries(new FormData(form)), project_name: project, due_date: due, reminder_date: reminder };
    setBusy(true); if (await mutate('', 'POST', body)) { form.reset(); setDue(''); setReminder(''); setProject(''); } setBusy(false);
  };
  return <section className="tasks-panel">
    <div className="tasks-page-heading"><span className="agenda-icon"><CalendarDays size={19} /></span><div><h2>Tasks & reminders</h2><p>Keep your next steps and deadlines in one place.</p></div><span className="tasks-open-count">{tasks.filter(t => !t.completed).length} open</span></div>
    <form className="tasks-create" onSubmit={add}>
      <label>Task<input required maxLength={240} name="title" placeholder="What needs to get done?" /></label>
      <label>Project<EditSelect label="Task project" value={project} options={[{value:'',label:'Personal / unassigned'},...projects.map(p => ({value:p.name,label:p.name}))]} onChange={setProject} /></label>
      <label>Due date<SessionDatePicker value={due} onChange={setDue} />{due && <button type="button" className="task-clear-date" onClick={() => setDue('')}>Clear date</button>}{!due && <small>Optional</small>}</label>
      <label>Remind me on<SessionDatePicker value={reminder} onChange={setReminder} />{reminder && <button type="button" className="task-clear-date" onClick={() => setReminder('')}>Clear reminder</button>}{!reminder && <small>Optional</small>}</label>
      <button disabled={busy}>{busy ? 'Saving…' : 'Add task'}</button>
    </form>
    {error && <p role="alert">{error}</p>}
    {!tasks.length && <p>No tasks yet. Add a deadline or reminder above.</p>}
    {tasks.map(task => <div className="task-line" key={task.id}>
      <input type="checkbox" aria-label={`Complete ${task.title}`} checked={task.completed} onChange={() => mutate(`/${task.id}`, 'PATCH', { completed: !task.completed })} />
      <div><strong style={{ textDecoration: task.completed ? 'line-through' : undefined }}>{task.title}</strong><small>{task.project_name || 'Personal'}{task.due_date ? ` · Due ${task.due_date.slice(0,10)}` : ''}{task.reminder_date ? ` · Reminder ${task.reminder_date.slice(0,10)}` : ''}</small></div>
      <button onClick={() => mutate(`/${task.id}`, 'DELETE')} aria-label={`Delete ${task.title}`}>Remove</button>
    </div>)}
  </section>;
};

export const TaskAgenda = ({ user, projects, studyPlan = [], onStart }) => {
  const { tasks, error, mutate } = useTasks(user);
  const today = new Date(); const key = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0,10);
  const items = [
    ...tasks.filter(t => !t.completed).map(t => ({ ...t, date: (t.due_date || '').slice(0,10), reminder: (t.reminder_date || '').slice(0,10) })),
    ...projects.flatMap(p => (p.subjects || []).filter(s => s.deadline).map(s => ({ id: `deadline-${s.id}`, title: s.name, project_name: p.name, date: s.deadline.slice(0,10), deadline: true }))),
  ].sort((a,b) => (a.date || a.reminder || '9999').localeCompare(b.date || b.reminder || '9999'));
  const duration = (seconds) => { const minutes = Math.ceil(Math.max(0, seconds) / 60); return minutes >= 60 ? `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ''}` : `${minutes}m`; };
  const dueLabel = (date) => date === key ? 'Today' : date < key ? 'Overdue' : new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const remaining = studyPlan.reduce((total, item) => total + item.remainingSeconds, 0);
  return <section className="task-agenda"><header><div className="agenda-heading"><span className="agenda-icon"><CalendarDays size={16} /></span><div><strong>Your agenda</strong><small>{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</small></div></div><a href="/manage" aria-label="Manage tasks">Manage <ArrowUpRight size={12} /></a></header>
    {error && <small role="alert">{error}</small>}
    <div className="task-agenda-list">
      <section className="agenda-study-section">
      <div className="agenda-section-label">TODAY’S STUDY PLAN<span>{remaining > 0 ? `${duration(remaining)} left` : 'Complete'}</span></div>
      {!studyPlan.length && <p className="agenda-empty">No study goals planned for today.</p>}
      {studyPlan.map(item => <div className="agenda-study-row" key={`${item.projectId}-${item.subjectId}`}>
        <span className={`agenda-plan-icon${item.progress >= 100 ? ' is-complete' : ''}`}>{item.progress >= 100 ? <Check size={13} /> : <Clock3 size={13} />}</span>
        <div className="agenda-study-copy"><strong>{item.subjectName}</strong><small>{item.projectName} · {duration(item.completedSeconds)} / {duration(item.targetSeconds)}</small><div className="agenda-progress"><i style={{ width: `${Math.min(100, item.progress)}%` }} /></div></div>
        <button type="button" onClick={() => onStart?.(item.projectId, item.subjectId)} aria-label={`Start ${item.subjectName}`}>{item.progress >= 100 ? 'Study' : 'Start'} <ArrowUpRight size={11} /></button>
      </div>)}
      </section><section className="agenda-tasks-section"><div className="agenda-section-label">TASKS & DEADLINES<span>{items.length} open</span></div>
      {!items.length && <p className="agenda-empty">No upcoming deadlines. You’re all caught up.</p>}{items.map(item => <div className={`task-line${item.date && item.date < key ? ' is-overdue' : ''}`} key={item.id}>
      {!item.deadline && <input type="checkbox" aria-label={`Complete ${item.title}`} onChange={() => mutate(`/${item.id}`, 'PATCH', { completed: true })} />}
      <div><strong>{item.title}</strong><small>{item.project_name || 'Personal'}</small></div>
      <span className={`agenda-due${item.date === key ? ' is-today' : ''}`}>{item.date ? dueLabel(item.date) : item.reminder ? `Remind ${dueLabel(item.reminder)}` : 'Anytime'}</span>
    </div>)}</section></div>
  </section>;
};
