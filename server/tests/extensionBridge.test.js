import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

test('legacy deployed timer updates the authenticated web workspace without truncating history',async()=>{
 let listener;const userId='account-a',prefix=`studyduel_user_${userId}_`;
 const entries=Array.from({length:150},(_,i)=>({id:`old-${i}`,startedAt:i,durationSeconds:60}));
 const active={projectId:'project',projectName:'Test project',subjectId:'subject',subjectName:'Subproject',startedAt:100000,note:''};
 const items={[prefix+'active_timer']:'null',[prefix+'time_entries']:JSON.stringify(entries)};
 const local=new Map(Object.entries(items));let notified=0;
 const call=async(path,method,body)=>{
  if(path==='/auth/me')return{user:{id:userId}};
  if(path==='/timer/start')return{activeTimer:active};
  if(path==='/timer/active')return{activeTimer:active};
  if(path==='/timer/entries')return{entries:[{id:'confirmed-entry',startedAt:500,durationSeconds:120}]};
  if(path==='/workspace')return{items:{...items}};
  if(path==='/workspace/item'){const change=JSON.parse(body);assert.ok(change.key.startsWith(prefix));items[change.key]=change.value;return{success:true};}
  throw new Error('Unexpected API path '+path);
 };
 const fetch=async(url,options={})=>new Response(JSON.stringify(await call(url.replace('/api',''),options.method,options.body)),{status:200});
 const chrome={runtime:{id:'test-extension',onMessage:{addListener:fn=>{listener=fn;}}}};
 vm.runInNewContext(await readFile(new URL('../../extension/content.js',import.meta.url),'utf8'),{chrome,fetch,Response,AbortSignal,Event,localStorage:{getItem:key=>local.get(key)||null,setItem:(key,value)=>local.set(key,value)},window:{dispatchEvent:()=>{notified++;}}});
 const result=await new Promise(resolve=>listener({type:'AUTHENTICATED_REQUEST',method:'POST',path:'/timer/start',body:'{}'},{id:'test-extension'},resolve));
 assert.equal(result.status,200);assert.equal(result.data.syncWarning,undefined);
 assert.equal(JSON.parse(local.get(prefix+'active_timer')).projectId,'project');
 assert.equal(JSON.parse(items[prefix+'time_entries']).length,151);assert.equal(notified,2);
 assert.equal(local.has('studyduel_user_account-b_active_timer'),false);
});
