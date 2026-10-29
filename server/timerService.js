import { randomUUID } from 'node:crypto';
export function serializeTimer(row) {
  if (!row) return null;
  return { projectId: row.project_id, projectName: row.project_name, subjectId: row.subproject_id || '', subjectName: row.subject_name || '', color: row.subject_color || row.project_color || '#777dd0', startedAt: new Date(row.started_at).getTime(), note: row.note || '', pausedAt: row.paused_at ? new Date(row.paused_at).getTime() : null, pausedSeconds: Number(row.paused_seconds) || 0, mode: row.mode || 'stopwatch', taskId: row.task_id || null };
}
export const timerSelect = `SELECT a.*,p.name AS project_name,p.color AS project_color,s.name AS subject_name,s.color AS subject_color FROM active_timers a JOIN projects p ON p.id=a.project_id LEFT JOIN subprojects s ON s.id=a.subproject_id WHERE a.user_id=$1`;
export async function canonicalTimerEntries(client,userId,data) {
  let local=[];try{local=JSON.parse(data[`studyduel_user_${userId}_time_entries`] || '[]');}catch{}
  const byId=new Map(local.map(entry=>[entry.id,entry]));
  const saved=await client.query(`SELECT e.*,p.name AS project_name,p.color AS project_color,s.name AS subject_name,s.color AS subject_color FROM time_entries e JOIN projects p ON p.id=e.project_id LEFT JOIN subprojects s ON s.id=e.subproject_id WHERE e.user_id=$1 ORDER BY e.started_at DESC`,[userId]);
  for(const row of saved.rows) {
    const entry={...byId.get(row.id),...serializeTimer(row),id:row.id,endedAt:new Date(row.ended_at).getTime(),durationSeconds:(new Date(row.ended_at)-new Date(row.started_at))/1000,source:row.source};
    byId.set(entry.id,entry);
  }
  return [...byId.values()].sort((a,b)=>Number(b.startedAt)-Number(a.startedAt));
}
export async function persistTimerWorkspace(client, userId, activeTimer, _entry, entriesOverride) {
  const prefix = `studyduel_user_${userId}_`;
  const existing = await client.query('SELECT data FROM user_workspace_state WHERE user_id=$1 FOR UPDATE', [userId]);
  const data = existing.rows[0]?.data || {};
  const patch = { [`${prefix}active_timer`]: JSON.stringify(activeTimer) };
  const entries=entriesOverride || await canonicalTimerEntries(client,userId,data);
  patch[`${prefix}time_entries`]=JSON.stringify(entries);
  await client.query(`INSERT INTO user_workspace_state(user_id,data) VALUES($1,$2::jsonb) ON CONFLICT(user_id) DO UPDATE SET data=user_workspace_state.data || EXCLUDED.data,updated_at=now() WHERE user_workspace_state.data IS DISTINCT FROM (user_workspace_state.data || EXCLUDED.data)`, [userId, JSON.stringify(patch)]);
}
export async function finishTimer(client, userId, active, now, discard = false) {
  if (!active) return null;
  let entry = null;
  if (!discard) {
    const timer = serializeTimer(active);
    const pausedSeconds = timer.pausedSeconds + (timer.pausedAt ? Math.max(0, (now.getTime() - timer.pausedAt) / 1000) : 0);
    const durationSeconds = Math.max(.001, (now.getTime() - timer.startedAt) / 1000 - pausedSeconds);
    const endedAt = now.getTime();
    // A paused session stores focused duration as a continuous interval ending now.
    const startedAt = endedAt - durationSeconds * 1000;
    const id = randomUUID();
    await client.query(`INSERT INTO time_entries(id,user_id,project_id,subproject_id,started_at,ended_at,note,source,task_id,mode) VALUES($1,$2,$3,$4,$5,$6,$7,'timer',$8,$9)`, [id,userId,active.project_id,active.subproject_id,new Date(startedAt),now,active.note || '',active.task_id,active.mode]);
    entry = { ...timer, id, startedAt, endedAt, durationSeconds, pausedAt: null, pausedSeconds: 0 };
  }
  await client.query('DELETE FROM active_timers WHERE user_id=$1', [userId]);
  return entry;
}
