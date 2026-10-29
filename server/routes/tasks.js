import { Router } from 'express';
import { query } from '../db.js';
import { authenticate } from '../middleware.js';
export const tasksRouter = Router();
tasksRouter.use(authenticate);
const validDate = (value) => !value || (/^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)));
tasksRouter.get('/', async (req, res) => {
  try { res.json((await query('SELECT * FROM user_tasks WHERE user_id=$1 ORDER BY completed, due_date NULLS LAST, created_at DESC', [req.userId])).rows); }
  catch { res.status(500).json({ error: 'Could not load tasks' }); }
});
tasksRouter.post('/', async (req, res) => {
  const { title, due_date, reminder_date, project_name = '', subproject_name = '' } = req.body;
  if (typeof title !== 'string' || !title.trim() || title.length > 240 || typeof project_name !== 'string' || project_name.length > 240 || typeof subproject_name !== 'string' || subproject_name.length > 240 || !validDate(due_date) || !validDate(reminder_date)) return res.status(400).json({ error: 'Check the task title and dates' });
  try { res.status(201).json((await query('INSERT INTO user_tasks(user_id,title,due_date,reminder_date,project_name,subproject_name) VALUES($1,$2,$3,$4,$5,$6) RETURNING *', [req.userId,title.trim(),due_date || null,reminder_date || null,project_name,subproject_name])).rows[0]); }
  catch { res.status(500).json({ error: 'Could not save task' }); }
});
tasksRouter.patch('/:id', async (req, res) => {
  if (!/^[\da-f-]{36}$/i.test(req.params.id) || typeof req.body.completed !== 'boolean') return res.status(400).json({ error: 'Invalid task' });
  try { const result = await query('UPDATE user_tasks SET completed=$1 WHERE id=$2 AND user_id=$3 RETURNING *', [req.body.completed,req.params.id,req.userId]); res.status(result.rows.length ? 200 : 404).json(result.rows[0] || { error: 'Task not found' }); }
  catch { res.status(500).json({ error: 'Could not update task' }); }
});
tasksRouter.delete('/:id', async (req,res) => {
  if (!/^[\da-f-]{36}$/i.test(req.params.id)) return res.status(400).json({ error: 'Invalid task' });
  try { await query('DELETE FROM user_tasks WHERE id=$1 AND user_id=$2',[req.params.id,req.userId]); res.sendStatus(204); }
  catch { res.status(500).json({ error: 'Could not delete task' }); }
});
