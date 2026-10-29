import React, { useEffect, useState } from 'react';
import './TasksPanel.css';
import { CalendarDays, ArrowUpRight, Check, Clock3 } from 'lucide-react';
import { EditSelect, SessionDatePicker } from '../timer/TimerEntriesList';

const dateKey = (date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const taskStatus = (task, today) => task.completed ? 'completed' : task.due_date?.slice(0, 10) < today ? 'overdue' : 'current';
const deadlineLabel = (date, now) => {
  // Date-only deadlines run through the end of the selected local day.
  const end = new Date(`${date}T00:00:00`); end.setDate(end.getDate() + 1);
  const hours = Math.ceil((end.getTime() - now.getTime()) / 3600000);
  if (hours <= 0) return 'Overdue';
  if (hours <= 24) return `${hours}h left`;
  return `${Math.ceil(hours / 24)} days left`;
};
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
  const [tab, setTab] = useState('all');
  const todayKey = dateKey(new Date());
  const taskTabs = [{ id: 'all', label: 'All' }, { id: 'current', label: 'Current' }, { id: 'overdue', label: 'Overdue' }, { id: 'completed', label: 'Completed' }];
  const visibleTasks = tasks.filter(task => tab === 'all' || taskStatus(task, todayKey) === tab)
    .sort((a, b) => Number(a.completed) - Number(b.completed) || (a.due_date || '9999').localeCompare(b.due_date || '9999'));
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
    <div className="task-status-tabs" role="tablist" aria-label="Task status">
      {taskTabs.map(item => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)}>{item.label}<span>{tasks.filter(task => item.id === 'all' || taskStatus(task, todayKey) === item.id).length}</span></button>)}
    </div>
    {!visibleTasks.length && <p className="agenda-empty">{tab === 'completed' ? 'Completed tasks will appear here.' : tab === 'overdue' ? 'No overdue tasks.' : 'No tasks in this view.'}</p>}
    {visibleTasks.map(task => <div className={`task-line${task.completed ? ' is-completed' : ''}`} key={task.id}>
      <input type="checkbox" aria-label={`Complete ${task.title}`} checked={task.completed} onChange={() => mutate(`/${task.id}`, 'PATCH', { completed: !task.completed })} />
      <div><strong style={{ textDecoration: task.completed ? 'line-through' : undefined }}>{task.title}</strong><small>{task.project_name || 'Personal'}{task.due_date ? ` · Due ${task.due_date.slice(0,10)}` : ''}{task.reminder_date ? ` · Reminder ${task.reminder_date.slice(0,10)}` : ''}</small></div>
      <button onClick={() => mutate(`/${task.id}`, 'DELETE')} aria-label={`Delete ${task.title}`}>Remove</button>
    </div>)}
  </section>;
};

export const TaskAgenda = ({ user, projects, studyPlan = [], onStart }) => {
  const { tasks, error, mutate } = useTasks(user);
  const [today, setToday] = useState(() => new Date());
  useEffect(() => { const tick = setInterval(() => setToday(new Date()), 60000); return () => clearInterval(tick); }, []);
  const key = dateKey(today);
  const orderedPlan = [...studyPlan].sort((a,b) => Number(a.progress >= 100) - Number(b.progress >= 100));
  const items = [
    ...tasks.map(t => ({ ...t, date: (t.due_date || '').slice(0,10), reminder: (t.reminder_date || '').slice(0,10) })),
    ...projects.flatMap(p => (p.subjects || []).filter(s => s.deadline).map(s => ({ id: `deadline-${s.id}`, title: s.name, project_name: p.name, date: s.deadline.slice(0,10), deadline: true }))),
  ].sort((a,b) => Number(Boolean(a.completed)) - Number(Boolean(b.completed)) || (a.date || a.reminder || '9999').localeCompare(b.date || b.reminder || '9999'));
  const duration = (seconds) => { const minutes = Math.ceil(Math.max(0, seconds) / 60); return minutes >= 60 ? `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ''}` : `${minutes}m`; };
  const dueLabel = (date) => deadlineLabel(date, today);
  const remaining = studyPlan.reduce((total, item) => total + item.remainingSeconds, 0);
  return <section className="task-agenda"><header><div className="agenda-heading"><div><strong>Today & upcoming</strong><small>{today.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</small></div></div><a href="/manage" aria-label="Manage tasks">Manage tasks</a></header>
    {error && <small role="alert">{error}</small>}
    <div className="task-agenda-list">
      <section className="agenda-study-section">
      <div className="agenda-section-label">TODAY’S STUDY PLAN<span>{remaining > 0 ? `${duration(remaining)} left` : 'Complete'}</span></div>
      <div className="agenda-column-items" tabIndex={0} role="region" aria-label="Today's study goals">
      {!studyPlan.length && <p className="agenda-empty">No study goals planned for today.</p>}
      {orderedPlan.map(item => <div className={`agenda-study-row${item.progress >= 100 ? ' is-completed' : ''}`} key={`${item.projectId}-${item.subjectId}`}>
        <span className={`agenda-plan-icon${item.progress >= 100 ? ' is-complete' : ''}`}>{item.progress >= 100 ? <Check size={13} /> : <Clock3 size={13} />}</span>
        <div className="agenda-study-copy"><strong>{item.subjectName}</strong><small>{item.projectName} · {duration(item.completedSeconds)} / {duration(item.targetSeconds)}</small><div className="agenda-progress"><i style={{ width: `${Math.min(100, item.progress)}%` }} /></div></div>
        <button type="button" onClick={() => onStart?.(item.projectId, item.subjectId)} aria-label={`Start ${item.subjectName}`}>{item.progress >= 100 ? 'Study' : 'Start'} <ArrowUpRight size={11} /></button>
      </div>)}
      </div></section><section className="agenda-tasks-section"><div className="agenda-section-label">TASKS & DEADLINES<span>{items.filter(item => !item.completed).length} open</span></div>
      <div className="agenda-column-items" tabIndex={0} role="region" aria-label="Tasks and deadlines">
      {!items.length && <p className="agenda-empty">No upcoming deadlines. You’re all caught up.</p>}{items.map(item => <div className={`task-line${item.completed ? ' is-completed' : item.date && item.date < key ? ' is-overdue' : ''}`} key={item.id}>
      {!item.deadline && <input type="checkbox" checked={Boolean(item.completed)} aria-label={`Complete ${item.title}`} onChange={() => mutate(`/${item.id}`, 'PATCH', { completed: !item.completed })} />}
      <div><strong>{item.title}</strong><small>{item.project_name || 'Personal'}</small></div>
      <span className={`agenda-due${item.date === key ? ' is-today' : ''}`} title={item.date || item.reminder || undefined}>{item.completed ? 'Done' : item.date ? dueLabel(item.date) : item.reminder ? `Remind ${dueLabel(item.reminder)}` : 'Anytime'}</span>
      {item.date && !item.completed && <div className="agenda-deadline-bar" role="meter" aria-label={`Time remaining for ${item.title}; full bar means seven days or more`} aria-valuemin={0} aria-valuemax={7} aria-valuenow={Math.min(7, Math.max(0, (new Date(`${item.date}T23:59:59`).getTime() - today.getTime()) / 86400000))} aria-valuetext={dueLabel(item.date)} title="Full bar = 7+ days remaining">
        <i style={{ width: `${Math.min(100, Math.max(0, (new Date(`${item.date}T23:59:59`).getTime() - today.getTime()) / (7 * 86400000) * 100))}%` }} />
      </div>}
    </div>)}</div></section></div>
  </section>;
};
