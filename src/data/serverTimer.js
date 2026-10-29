import { applyRemoteItem, flushWorkspace } from './workspaceSync';
let busy = false;
let refreshing = null;
export async function refreshServerTimer(userId, force = false) {
  if (busy && !force) return;
  if (refreshing) return refreshing;
  refreshing = loadTimer(userId).finally(() => { refreshing = null; });
  return refreshing;
}
async function loadTimer(userId) {
  await flushWorkspace();
  const response=await fetch('/api/timer/state',{credentials:'same-origin',signal:AbortSignal.timeout(15000)});
  const data=await response.json();
  if(!response.ok) throw new Error(data.error || 'Could not load your timer.');
  const patch={ [`studyduel_user_${userId}_active_timer`]:JSON.stringify(data.activeTimer), [`studyduel_user_${userId}_time_entries`]:JSON.stringify(data.entries) };
  let changed=false;
  for(const [key,value] of Object.entries(patch)) if(localStorage.getItem(key)!==value) { applyRemoteItem(key,value);changed=true; }
  window.dispatchEvent(new CustomEvent('plothour:remote-items',{detail:patch}));
  if(changed) { window.dispatchEvent(new Event('studyduel:timer-storage')); window.dispatchEvent(new Event('storage')); }
  return data;
}
export async function commandTimer(userId,action,body={}) {
  if(busy) throw new Error('A timer change is already being saved.');
  busy=true;
  try {
    if (refreshing) await refreshing;
    await flushWorkspace();
    const commandId=crypto.randomUUID();
    // One command ID is reused after an ambiguous network failure.
    let response;
    for(let attempt=0;attempt<2;attempt++) {
      try { response=await fetch(`/api/timer/${action}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,commandId}),signal:AbortSignal.timeout(15000)});break; }
      catch(error) {if(attempt===1) throw error;}
    }
    const data=await response.json();
    if(!response.ok) throw new Error(data.error || 'Could not save your timer. Please retry.');
    await refreshServerTimer(userId, true);
    return data;
  } finally {busy=false;}
}
