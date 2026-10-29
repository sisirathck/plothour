import React, { useEffect, useState } from 'react';
import './TasksPanel.css';

export function useTasks(user) {
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState('');
  const load = async () => {
    if (!user?.id) return;
    try { const response = await fetch('/api/tasks'); if (!response.ok) throw new Error('Could not load tasks'); setTasks(await response.json()); setError(''); }
    catch (e) { setError(e.message); }
  };
  useEffect(() => { setTasks([]); load(); window.addEventListener('tasks-changed', load); return () => window.removeEventListener('tasks-changed', load); }, [user?.id]);
  const mutate = async (path, method, body) => {
    try {
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
  const add = async (event) => {
    event.preventDefault(); const form = event.currentTarget;
    const body = Object.fromEntries(new FormData(form));
    setBusy(true); if (await mutate('', 'POST', body)) form.reset(); setBusy(false);
  };
  return <section className="tasks-panel">
    <h2>Tasks & reminders</h2><p>Assignments, homework, and the deadlines you want to keep in sight.</p>
    <form className="tasks-create" onSubmit={add}>
      <label>Task<input required maxLength={240} name="title" placeholder="What needs to get done?" /></label>
      <label>Project<select name="project_name"><option value="">Personal / unassigned</option>{projects.map(p => <option key={p.id}>{p.name}</option>)}</select></label>
      <label>Due date<input type="date" name="due_date" /></label>
      <label>Remind me on<input type="date" name="reminder_date" /></label>
      <button disabled={busy || !user?.id}>{busy ? 'Saving…' : 'Add task'}</button>
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

export const TaskAgenda = ({ user, projects }) => {
  const { tasks, error, mutate } = useTasks(user);
  const today = new Date(); const key = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0,10);
  const items = [
    ...tasks.filter(t => !t.completed).map(t => ({ ...t, date: (t.due_date || '').slice(0,10), reminder: (t.reminder_date || '').slice(0,10) })),
    ...projects.flatMap(p => (p.subjects || []).filter(s => s.deadline).map(s => ({ id: `deadline-${s.id}`, title: s.name, project_name: p.name, date: s.deadline.slice(0,10), deadline: true }))),
  ].sort((a,b) => (a.date || a.reminder || '9999').localeCompare(b.date || b.reminder || '9999'));
  return <section className="task-agenda"><header><strong>Tasks & deadlines</strong><a href="/manage">Manage tasks ↗</a></header>
    {error && <small role="alert">{error}</small>}
    <div className="task-agenda-list">{!items.length && <p>You’re all caught up. Add tasks from Tasks & reminders.</p>}{items.map(item => <div className={`task-line${item.date && item.date < key ? ' is-overdue' : ''}`} key={item.id}>
      {!item.deadline && <input type="checkbox" aria-label={`Complete ${item.title}`} onChange={() => mutate(`/${item.id}`, 'PATCH', { completed: true })} />}
      <div><strong>{item.title}</strong><small>{item.project_name || 'Personal'}</small></div>
      <span>{item.reminder && item.reminder <= key ? 'Reminder · ' : ''}{item.date ? `${item.date < key ? 'Overdue · ' : item.date === key ? 'Today · ' : ''}${item.date}` : item.reminder ? `Remind ${item.reminder}` : 'No due date'}</span>
    </div>)}</div>
    <footer>{projects.reduce((n,p) => n + (p.subjects || []).filter(s => Number(s.goals?.weekly) > 0).length,0)} weekly study goals · {items.length} open items</footer>
  </section>;
};
