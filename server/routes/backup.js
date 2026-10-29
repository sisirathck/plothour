import { Router } from 'express';
import { pool, query } from '../db.js';
import { authenticate } from '../middleware.js';
import { syncWorkspaceProjection } from '../workspaceProjection.js';
export const backupRouter=Router();backupRouter.use(authenticate);
const parse=(value,fallback)=>{try{return JSON.parse(value);}catch{return fallback;}};
backupRouter.get('/',async(req,res)=>{
  try {
    const [workspace,tasks,sharing,recipients,emailSettings]=await Promise.all([query('SELECT data FROM user_workspace_state WHERE user_id=$1',[req.userId]),query('SELECT * FROM user_tasks WHERE user_id=$1',[req.userId]),query('SELECT partner_id,project_ids,share_project_names FROM comparison_sharing WHERE user_id=$1',[req.userId]),query('SELECT email,status FROM email_report_recipients WHERE user_id=$1',[req.userId]),query("SELECT preferences->'emailReports' AS settings FROM user_preferences WHERE user_id=$1",[req.userId])]);
    const prefix=`studyduel_user_${req.userId}_`;
    const items=Object.fromEntries(Object.entries(workspace.rows[0]?.data || {}).filter(([key])=>key.startsWith(prefix)&&!key.endsWith('_active_timer')));
    res.setHeader('Cache-Control','no-store');res.json({format:'plothour-workspace',version:1,accountId:req.userId,exportedAt:new Date().toISOString(),items,tasks:tasks.rows,sharing:sharing.rows,recipients:recipients.rows,emailPreferences:emailSettings.rows[0]?.settings || null,notes:'Restore merges projects, sessions and missing tasks into this same account. It does not start timers, enable email delivery, re-invite recipients, or expand sharing permissions.'});
  }catch{res.status(500).json({error:'Could not create your workspace backup.'});}
});
backupRouter.post('/restore',async(req,res)=>{
  const backup=req.body;
  if(backup?.format!=='plothour-workspace'||backup.version!==1||backup.accountId!==req.userId||!backup.items||typeof backup.items!=='object'||Array.isArray(backup.items)||!Array.isArray(backup.tasks)||backup.tasks.length>10000) return res.status(400).json({error:'Choose a valid workspace backup from this account.'});
  const prefix=`studyduel_user_${req.userId}_`;
  const allowed=new Set(['projects','time_entries','preferences','onboarding_done','dashboard_sections','dashboard_order','dashboard_range','compare_profile_colors','compare_details','reminders','theme','theme_mode']);
  const incoming={};
  for(const [key,value] of Object.entries(backup.items)){
    const suffix=key.slice(prefix.length);
    if(!key.startsWith(prefix)||typeof value!=='string'||Buffer.byteLength(value)>1000000) return res.status(400).json({error:'This backup contains invalid workspace records.'});
    if(allowed.has(suffix)) incoming[key]=value;
  }
  if(backup.tasks.some(t=>typeof t.title!=='string'||!t.title.trim()||t.title.length>240||!/^[\da-f-]{36}$/i.test(t.id||''))) return res.status(400).json({error:'This backup contains invalid task records.'});
  const client=await pool.connect();
  try{
    await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[req.userId]);
    const current=(await client.query('SELECT data FROM user_workspace_state WHERE user_id=$1 FOR UPDATE',[req.userId])).rows[0]?.data||{};
    const merged={...current};
    for(const [key,value] of Object.entries(incoming)){
      if(key===`${prefix}projects`||key===`${prefix}time_entries`){
        const existing=parse(current[key]||'[]',[]),restored=parse(value,null);
        if(!Array.isArray(restored)||!Array.isArray(existing)) throw new Error('Invalid project or session list.');
        const byId=new Map(restored.map(item=>[item.id,item]));
        // Existing records win. Merge missing subprojects without replacing edits.
        for(const item of existing){const old=byId.get(item.id);byId.set(item.id,key.endsWith('_projects')&&old ? {...old,...item,subjects:[...(item.subjects||[]),...(old.subjects||[]).filter(sub=>!(item.subjects||[]).some(currentSub=>currentSub.id===sub.id))]}:item);}
        merged[key]=JSON.stringify([...byId.values()]);
      }else if(!(key in current)) merged[key]=value;
    }
    await syncWorkspaceProjection(client,req.userId,merged);
    await client.query(`INSERT INTO user_workspace_state(user_id,data) VALUES($1,$2::jsonb) ON CONFLICT(user_id) DO UPDATE SET data=EXCLUDED.data,updated_at=now()`,[req.userId,JSON.stringify(merged)]);
    for(const task of backup.tasks)await client.query(`INSERT INTO user_tasks(id,user_id,title,project_name,subproject_name,due_date,reminder_date,completed) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(id) DO NOTHING`,[task.id,req.userId,task.title,task.project_name || '',task.subproject_name || '',task.due_date?.slice(0,10)||null,task.reminder_date?.slice(0,10)||null,Boolean(task.completed)]);
    if(backup.emailPreferences && typeof backup.emailPreferences==='object' && !Array.isArray(backup.emailPreferences)) await client.query(`INSERT INTO user_preferences(user_id,preferences) VALUES($1,jsonb_build_object('emailReports',$2::jsonb)) ON CONFLICT(user_id) DO UPDATE SET preferences=user_preferences.preferences || jsonb_build_object('emailReports',$2::jsonb) WHERE NOT(user_preferences.preferences ? 'emailReports')`,[req.userId,JSON.stringify({...backup.emailPreferences,enabled:false,taskRemindersEnabled:false})]);
    await client.query('COMMIT');res.json({restored:true});
  }catch{await client.query('ROLLBACK');res.status(400).json({error:'This backup could not be restored. No changes were applied.'});}finally{client.release();}
});
