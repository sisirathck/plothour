import test from 'node:test';
import assert from 'node:assert/strict';

test('failed workspace writes remain durable, retry, and conflicts never discard edits',async()=>{
 class StorageMock{constructor(){this.data=new Map();}getItem(k){return this.data.get(k)??null;}setItem(k,v){this.data.set(k,String(v));}removeItem(k){this.data.delete(k);}}
 const saved={Storage:globalThis.Storage,window:globalThis.window,localStorage:globalThis.localStorage,fetch:globalThis.fetch};
 globalThis.Storage=StorageMock;globalThis.localStorage=new StorageMock();
 const events=new EventTarget();globalThis.window=Object.assign(events,{setTimeout:(fn,ms)=>{const timer=setTimeout(fn,ms);timer.unref();return timer;},clearTimeout});
 let fail=true,conflict=false;
 globalThis.fetch=async(_url,options={})=>(!options.method || options.method==='GET')?new Response(JSON.stringify({initialized:true,items:{}})):new Response(JSON.stringify({error:conflict?'Changed on another device':'Temporary failure'}),{status:conflict?409:fail?500:200});
 let disconnect;
 try{
  const mod=await import(`../../src/data/workspaceSync.js?test=${Date.now()}`);disconnect=await mod.connectWorkspaceSync('test');
  localStorage.setItem('studyduel_user_test_projects','[{"id":"project"}]');
  await assert.rejects(mod.flushWorkspace());assert.equal(mod.getWorkspaceSyncStatus().pending,1);assert.ok(localStorage.getItem('plothour_outbox_test').includes('project'));
  fail=false;await mod.flushWorkspace();assert.equal(mod.getWorkspaceSyncStatus().state,'saved');assert.equal(localStorage.getItem('plothour_outbox_test'),'{}');
  localStorage.setItem('studyduel_user_test_projects','[{"id":"changed"}]');conflict=true;await assert.rejects(mod.flushWorkspace());assert.equal(mod.getWorkspaceSyncStatus().state,'conflict');assert.ok(localStorage.getItem('plothour_outbox_test').includes('changed'));
  conflict=false;await mod.resolveWorkspaceConflict('studyduel_user_test_projects','server');assert.equal(localStorage.getItem('studyduel_user_test_projects'),null);assert.ok(localStorage.getItem('plothour_conflicts_test').includes('changed'));
  localStorage.setItem('studyduel_user_test_projects','[{"id":"local-choice"}]');await mod.resolveWorkspaceConflict('studyduel_user_test_projects','local');assert.equal(mod.getWorkspaceSyncStatus().state,'saved');assert.ok(localStorage.getItem('studyduel_user_test_projects').includes('local-choice'));
 }finally{disconnect?.();Object.assign(globalThis,saved);}
});
