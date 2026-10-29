// Creates and removes only synthetic test accounts on the local development API.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { renderReport } from '../server/routes/emailReports.js';
import { pool } from '../server/db.js';
import { hashPassword } from '../server/auth.js';
const base=process.env.TEST_API_URL || 'http://127.0.0.1:3001';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname)) throw new Error('This check is for a local development API only.');
const users=[randomUUID(),randomUUID()];const project=randomUUID(),privateProject=randomUUID(),subject=randomUUID();
const password=randomUUID()+'-Aa9!';const email=`runtime-${users[0]}@example.invalid`;
const q=(text,params)=>pool.query(text,params);
let token;
async function request(path,body,auth=token,method=body===undefined?'GET':'POST'){
  const response=await fetch(`${base}/api${path}`,{method,headers:{'Content-Type':'application/json',...(auth?{Authorization:`Bearer ${auth}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  return {status:response.status,data:await response.json().catch(()=>({}))};
}
try{
 let ready=false;
 for(let attempt=0;attempt<60;attempt++) {
   try{const health=await fetch(`${base}/api/health`);if((await health.json()).databaseReady){ready=true;break;}}catch{}
   await new Promise(resolve=>setTimeout(resolve,250));
 }
 assert.ok(ready,'Wait for the local API and database migrations to finish.');
 const hash=await hashPassword(password);
 for(const [index,id]of users.entries())await q('INSERT INTO users(id,email,password_hash,display_name,email_verified) VALUES($1,$2,$3,$4,true)',[id,index?`runtime-${id}@example.invalid`:email,hash,`Runtime test ${index}`]);
 const login=await request('/auth/login',{email,password},null);assert.equal(login.status,200);token=login.data.token;
 assert.equal((await request('/auth/me')).data.user.id,users[0]);
 const prefix=`studyduel_user_${users[0]}_`;
 const projects=[{id:project,name:'Shared test project',subjects:[{id:subject,name:'Test subject',goals:{daily:1,weekly:5}}]},{id:privateProject,name:'Private test project',subjects:[]}];
 const imported=await request('/workspace/import',{items:{[prefix+'projects']:JSON.stringify(projects),[prefix+'time_entries']:'[]'}},token,'PUT');assert.equal(imported.status,200,JSON.stringify(imported.data));
 const startId=randomUUID();const first=await request('/timer/start',{projectId:project,subjectId:subject,commandId:startId});assert.equal(first.status,200,JSON.stringify(first.data));assert.equal(first.data.activeTimer.subjectName,'Test subject');
 const repeat=await request('/timer/start',{projectId:project,subjectId:subject,commandId:startId});assert.equal(repeat.data.activeTimer.startedAt,first.data.activeTimer.startedAt);
 const invalid=await request('/timer/start',{projectId:project,subjectId:randomUUID(),commandId:randomUUID()});assert.equal(invalid.status,400);assert.equal((await request('/timer/active')).data.activeTimer.startedAt,first.data.activeTimer.startedAt);
 await request('/timer/pause',{commandId:randomUUID()});assert.ok((await request('/timer/active')).data.activeTimer.pausedAt);
 await request('/timer/resume',{commandId:randomUUID()});assert.equal((await request('/timer/active')).data.activeTimer.pausedAt,null);
 const stopId=randomUUID();const stops=await Promise.all([request('/timer/stop',{commandId:stopId}),request('/timer/stop',{commandId:stopId})]);assert.equal(stops[0].data.entry.id,stops[1].data.entry.id);
 const state=await request('/timer/state');assert.equal(state.data.entries.length,1);assert.equal(state.data.activeTimer,null);
 assert.equal(Number((await q('SELECT COUNT(*) FROM time_entries WHERE user_id=$1',[users[0]])).rows[0].count),1);
 console.log('PASS: transactional timer, idempotent retry, invalid switch rollback, pause/resume, workspace history');
 const changed=await request('/workspace/item',{key:prefix+'time_entries',value:'[]',expectedValue:'[]'},token,'PUT');assert.equal(changed.status,409);
 assert.equal((await request('/timer/state')).data.entries.length,1);
 console.log('PASS: stale workspace write rejected without losing server sessions');
 await q('INSERT INTO friendships(user_low_id,user_high_id) VALUES(LEAST($1::uuid,$2::uuid),GREATEST($1::uuid,$2::uuid))',users);
 const login2=await request('/auth/login',{email:`runtime-${users[1]}@example.invalid`,password},null);const token2=login2.data.token;
 const from=Date.now()-86400000,to=Date.now()+86400000;
 const params=new URLSearchParams({profileIds:users.join(','),from,to,previousFrom:from-172800000,previousTo:from-1,recentFrom:from,recentTo:to,weekStartsOn:1,calendarDays:2,rangeType:'custom'});
 const hidden=await request('/connections/comparison?'+params,undefined,token2);assert.equal(hidden.status,200,JSON.stringify(hidden.data));assert.equal(hidden.data.profiles.find(p=>p.id===users[0]).current.seconds,0);
 assert.equal((await request(`/connections/sharing/${users[1]}`,{projectIds:[project],shareProjectNames:false},token,'PUT')).status,200);
 const shared=await request('/connections/comparison?'+params,undefined,token2);const own=shared.data.profiles.find(p=>p.id===users[0]);assert.ok(own.current.seconds>0);assert.equal(own.current.projectBreakdown[0].name,'Shared project');
 await request(`/connections/sharing/${users[1]}`,{projectIds:[],shareProjectNames:false},token,'PUT');
 assert.equal((await request('/connections/comparison?'+params,undefined,token2)).data.profiles.find(p=>p.id===users[0]).current.seconds,0);
 console.log('PASS: sharing defaults private, per-person project selection, hidden names, revoked access');
 const task=await request('/tasks',{title:'Runtime task',project_name:'Shared test project'});assert.equal(task.status,201);
 await request('/timer/start',{projectId:project,taskId:task.data.id,commandId:randomUUID()});const linked=await request('/timer/stop',{commandId:randomUUID()});assert.equal(linked.data.entry.taskId,task.data.id);
 const backup=await request('/backup');assert.equal(backup.data.format,'plothour-workspace');assert.equal(backup.data.items[prefix+'active_timer'],undefined);assert.equal(backup.data.tasks.length,1);
 assert.equal((await request('/backup/restore',backup.data)).status,200);
 assert.equal((await request('/backup/restore',{...backup.data,accountId:users[1]})).status,400);
 assert.equal((await request('/email-reports/history')).status,200);
 console.log('PASS: linked tasks, full backup, safe merge, account isolation, delivery history');
 for(const type of ['agenda','weekly-plan','weekly-recap','monthly-recap','comparison']) {
   const report=await renderReport(users[0],{display_name:'Runtime',timezone:'UTC',week_starts_on:1},{type,range:'This month',includeUpcomingTasks:true});
   assert.ok(report.html.includes('YOUR STUDY LETTER'));assert.ok(report.text.length);assert.ok(!report.html.includes('undefined'));
 }
 console.log('PASS: all five report types render real database data with the shared email design');

 // Run the actual extension service-worker script against the live local API.
 const storage={};let listener;const ext={storage:{local:{get:async keys=>Object.fromEntries(keys.map(k=>[k,storage[k]])),set:async values=>Object.assign(storage,values),remove:async keys=>keys.forEach(k=>delete storage[k])}},action:{setBadgeText:async()=>{},setBadgeBackgroundColor:async()=>{}},tabs:{create:async()=>{},query:async()=>[]},alarms:{create:()=>{},onAlarm:{addListener:()=>{}}},runtime:{getURL:path=>`chrome-extension://runtime-test/${path}`,onMessage:{addListener:fn=>{listener=fn;}},onStartup:{addListener:()=>{}}}};
 vm.runInNewContext(await readFile(new URL('../extension/background.js',import.meta.url),'utf8'),{chrome:ext,fetch,URL,AbortSignal,crypto:globalThis.crypto,console});
 const call=message=>new Promise(resolve=>listener(message,{url:'chrome-extension://runtime-test/popup.html'},resolve));
 const extLogin=await call({type:'LOGIN',origin:base,email,password});assert.ok(extLogin.success,extLogin.error);
 const extState=await call({type:'GET_STATE'});assert.equal(extState.projects.length,2);assert.equal(extState.user.id,users[0]);
 const extStart=await call({type:'START_TIMER',projectId:project,subjectId:subject});assert.ok(extStart.success,extStart.error);assert.equal(extStart.activeTimer.subjectId,subject);
 const extStop=await call({type:'STOP_TIMER',expectedStartedAt:extStart.activeTimer.startedAt});assert.ok(extStop.success,extStop.error);assert.ok(extStop.entry.id);assert.equal(extStop.activeTimer,null);
 console.log('PASS: real extension worker login → projects/subprojects → start → stop against local API');
 const legacyId=randomUUID();
 await q(`INSERT INTO time_entries(id,user_id,project_id,started_at,ended_at,source) VALUES($1,$2,$3,now()-interval '2 hours',now()-interval '1 hour','timer')`,[legacyId,users[0],project]);
 const reconciled=await request('/timer/state');assert.ok(reconciled.data.entries.some(entry=>entry.id===legacyId));
 const currentValue=JSON.stringify(reconciled.data.entries);
 const afterDelete=JSON.stringify(reconciled.data.entries.filter(entry=>entry.id!==legacyId));
 assert.equal((await request('/workspace/item',{key:prefix+'time_entries',value:afterDelete,expectedValue:currentValue},token,'PUT')).status,200);
 assert.ok(!(await request('/timer/state')).data.entries.some(entry=>entry.id===legacyId));
 console.log('PASS: old extension history is preserved and explicit session deletion stays synchronized');

 // Exercise the Google/browser-session path without exporting its cookie/token.
 let contentListener;
 const contentExt={runtime:{id:'runtime-test',onMessage:{addListener:fn=>{contentListener=fn;}}}};
 const browserFetch=(path,options={})=>fetch(`${base}${path}`,{...options,headers:{...options.headers,Cookie:`studyduel_session=${token}`}});
 vm.runInNewContext(await readFile(new URL('../extension/content.js',import.meta.url),'utf8'),{chrome:contentExt,fetch:browserFetch,AbortSignal,console});
 ext.tabs.query=async()=>[{id:42,url:base+'/timer',active:true}];
 ext.tabs.sendMessage=async(_id,message)=>new Promise(resolve=>contentListener(message,{id:'runtime-test'},resolve));
 const extToken=storage.studyduel_token;
 const connected=await call({type:'CONNECT_TAB'});assert.ok(connected.success,connected.error);assert.equal(storage.studyduel_token,undefined);assert.equal(storage.studyduel_tab_id,42);
 const sessionState=await call({type:'GET_STATE'});assert.equal(sessionState.user.id,users[0]);
 const sessionStart=await call({type:'START_TIMER',projectId:project,subjectId:subject});assert.ok(sessionStart.success,sessionStart.error);
 const sessionStop=await call({type:'STOP_TIMER',expectedStartedAt:sessionStart.activeTimer.startedAt});assert.ok(sessionStop.success,sessionStop.error);
 console.log('PASS: browser-session/Google connection uses the app cookie without copying credentials, and starts/stops a timer');

 await request('/auth/logout',{},extToken);
 assert.equal((await request('/timer/active',undefined,extToken)).status,401);
 console.log('PASS: ended login session cannot use timer APIs');
}finally{
 await q('DELETE FROM active_timers WHERE user_id=ANY($1::uuid[])',[users]);
 await q('DELETE FROM time_entries WHERE user_id=ANY($1::uuid[])',[users]);
 await q('DELETE FROM subprojects WHERE project_id IN (SELECT id FROM projects WHERE user_id=ANY($1::uuid[]))',[users]);
 await q('DELETE FROM projects WHERE user_id=ANY($1::uuid[])',[users]);
 await q('DELETE FROM users WHERE id=ANY($1::uuid[])',[users]);await pool.end();
}
