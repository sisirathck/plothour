import { Router } from 'express';
import { pool, query } from '../db.js';
import { authenticate } from '../middleware.js';
import { serializeTimer, timerSelect, persistTimerWorkspace, finishTimer, canonicalTimerEntries } from '../timerService.js';
export const timerRouter = Router();
timerRouter.use(authenticate);
const uuid = value => typeof value === 'string' && /^[\da-f]{8}-[\da-f]{4}-[1-8][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(value);
timerRouter.get('/active', async (req,res) => {
  try { res.json({ activeTimer: serializeTimer((await query(timerSelect,[req.userId])).rows[0]), workspaceSynced: true }); }
  catch { res.status(500).json({ error: 'Could not load your timer. Please retry.' }); }
});
timerRouter.get('/state', async (req,res) => {
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN'); await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[req.userId]);
      const activeTimer = serializeTimer((await client.query(timerSelect,[req.userId])).rows[0]);
      const workspace = (await client.query('SELECT data FROM user_workspace_state WHERE user_id=$1',[req.userId])).rows[0]?.data || {};
      const entries=await canonicalTimerEntries(client,req.userId,workspace);
      await persistTimerWorkspace(client,req.userId,activeTimer,null,entries);
      await client.query('COMMIT');
      res.setHeader('Cache-Control','no-store');
      res.json({ activeTimer, entries, workspaceSynced:true });
    } catch(error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  } catch { res.status(500).json({ error: 'Could not synchronize your timer.' }); }
});
timerRouter.get('/entries', async (req,res) => {
  try {
    const result = await query(`SELECT e.*,p.name AS project_name,s.name AS subject_name,p.color AS project_color FROM time_entries e JOIN projects p ON p.id=e.project_id LEFT JOIN subprojects s ON s.id=e.subproject_id WHERE e.user_id=$1 ORDER BY e.started_at DESC`,[req.userId]);
    res.json({ entries: result.rows.map(row => ({ ...serializeTimer(row), id: row.id, endedAt: new Date(row.ended_at).getTime(),durationSeconds: (new Date(row.ended_at)-new Date(row.started_at))/1000 })) });
  } catch { res.status(500).json({error:'Could not load sessions.'}); }
});
for (const action of ['start','stop','pause','resume','discard']) timerRouter.post(`/${action}`,async(req,res) => {
  const { projectId, subjectId, taskId, commandId, expectedStartedAt, note='', mode='stopwatch' } = req.body || {};
  if ((commandId && !uuid(commandId)) || (action==='start' && (!uuid(projectId) || (subjectId && !uuid(subjectId)) || (taskId && !uuid(taskId)) || typeof note!=='string' || note.length>1024 || !(['stopwatch','pomodoro','countdown'].includes(mode) || /^([1-9]\d{0,2})m$/.test(mode))))) return res.status(400).json({error:'Check the project, subproject and session details.'});
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[req.userId]);
    if(commandId) {
      const previous=await client.query('SELECT response FROM timer_commands WHERE user_id=$1 AND command_id=$2',[req.userId,commandId]);
      if(previous.rows.length) { await client.query('COMMIT'); return res.json(previous.rows[0].response); }
    }
    const old=(await client.query(timerSelect,[req.userId])).rows[0];
    const now=(await client.query('SELECT clock_timestamp() AS now')).rows[0].now;
    if(action==='start' && Object.hasOwn(req.body,'expectedStartedAt') && expectedStartedAt===null && old) throw Object.assign(new Error('A timer is already running on another device. Refresh before switching.'),{status:409});
    if(expectedStartedAt && old && Math.abs(new Date(old.started_at).getTime()-Number(expectedStartedAt))>1) throw Object.assign(new Error('Your timer changed on another device. Refresh and try again.'),{status:409});
    let entry=null;
    if(action==='start') {
      const project=(await client.query('SELECT id FROM projects WHERE id=$1 AND user_id=$2 AND archived_at IS NULL',[projectId,req.userId])).rows[0];
      if(!project) throw Object.assign(new Error('This project is unavailable. Refresh your projects.'),{status:404});
      if(subjectId && !(await client.query('SELECT id FROM subprojects WHERE id=$1 AND project_id=$2 AND archived_at IS NULL',[subjectId,projectId])).rows.length) throw Object.assign(new Error('Choose a subproject belonging to this project.'),{status:400});
      if(taskId && !(await client.query('SELECT id FROM user_tasks WHERE id=$1 AND user_id=$2 AND completed=false',[taskId,req.userId])).rows.length) throw Object.assign(new Error('This task is unavailable.'),{status:400});
      entry=await finishTimer(client,req.userId,old,now);
      await client.query(`INSERT INTO active_timers(user_id,project_id,subproject_id,started_at,note,mode,task_id) VALUES($1,$2,$3,$4,$5,$6,$7)`,[req.userId,projectId,subjectId || null,now,note,mode,taskId || null]);
    } else if(action==='stop' || action==='discard') entry=await finishTimer(client,req.userId,old,now,action==='discard');
    else if(old && action==='pause' && !old.paused_at) await client.query('UPDATE active_timers SET paused_at=$2 WHERE user_id=$1',[req.userId,now]);
    else if(old && action==='resume' && old.paused_at) await client.query('UPDATE active_timers SET paused_seconds=paused_seconds+EXTRACT(EPOCH FROM ($2::timestamptz-paused_at)),paused_at=NULL WHERE user_id=$1',[req.userId,now]);
    const activeTimer=serializeTimer((await client.query(timerSelect,[req.userId])).rows[0]);
    await persistTimerWorkspace(client,req.userId,activeTimer,entry);
    const result={activeTimer,entry,workspaceSynced:true};
    if(commandId) await client.query('INSERT INTO timer_commands(user_id,command_id,response) VALUES($1,$2,$3)',[req.userId,commandId,JSON.stringify(result)]);
    await client.query('COMMIT'); return res.json(result);
  } catch(error) { await client.query('ROLLBACK'); return res.status(error.status || 500).json({error:error.status ? error.message : 'Could not save timer changes. Your previous timer is preserved; please retry.'}); }
  finally {client.release();}
});
