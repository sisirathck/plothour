const originalSet = Storage.prototype.setItem;
const originalRemove = Storage.prototype.removeItem;
let activeFlush = async () => {};
let activeResolve = async () => {};
export const resolveWorkspaceConflict = (key,choice) => activeResolve(key,choice);
let status = { state: 'saved', pending: 0 };
export const getWorkspaceSyncStatus = () => status;
const publish = (state, pending, message = '', conflicts = []) => {
  status = { state, pending, message, conflicts };
  window.dispatchEvent(new CustomEvent('plothour:sync-status', { detail: status }));
};
export function applyRemoteItem(key, value) {
  originalSet.call(localStorage, key, value);
}
export const flushWorkspace = () => activeFlush();
export async function connectWorkspaceSync(userId) {
  const prefix = `studyduel_user_${userId}_`;
  const outboxKey = `plothour_outbox_${userId}`;
  let pending; try { pending = JSON.parse(localStorage.getItem(outboxKey) || '{}'); } catch { pending = {}; }
  let baseline = {};
  let stopped = false;
  let timer;
  let inFlight = null;
  async function request(path, options = {}) {
    const response = await fetch(`/api/workspace${path}`, { credentials: 'same-origin', ...options, headers: { 'Content-Type':'application/json' }, signal: AbortSignal.timeout(15000) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(payload.error || 'Could not save your workspace.'), { status: response.status, remoteValue: payload.currentValue });
    return payload;
  }
  const persist = () => originalSet.call(localStorage, outboxKey, JSON.stringify(pending));
  let remote = await request('/');
  if (!remote.initialized) {
    const items = {};
    for (const key of Object.keys(localStorage)) if (key.startsWith(prefix)) items[key] = localStorage.getItem(key);
    remote = await request('/import', { method:'PUT', body:JSON.stringify({ items }) });
  }
  baseline = { ...remote.items };
  for (const key of Object.keys(localStorage)) if(key.startsWith(prefix) && !pending[key] && !(key in baseline)) originalRemove.call(localStorage,key);
  for (const [key,value] of Object.entries(baseline)) if (!pending[key]) applyRemoteItem(key,value);
  for (const [key,item] of Object.entries(pending)) {
    if(item.deleted) originalRemove.call(localStorage,key); else applyRemoteItem(key,item.value);
  }
  async function drain() {
    if (inFlight) return inFlight;
    inFlight = (async () => {
      while (Object.keys(pending).length) {
        const [key,item] = Object.entries(pending)[0];
        publish('saving',Object.keys(pending).length);
        try {
          await request('/item', { method: item.deleted ? 'DELETE' : 'PUT', body:JSON.stringify({ key, value:item.value, expectedValue: Object.hasOwn(item,'expectedValue') ? item.expectedValue : baseline[key] ?? null }) });
          baseline[key] = item.deleted ? undefined : item.value;
          if (pending[key] === item) delete pending[key];
          else if (pending[key]) pending[key].expectedValue = item.deleted ? null : item.value;
          persist();
        } catch(error) {
          publish(error.status === 409 ? 'conflict' : navigator.onLine ? 'error' : 'offline',Object.keys(pending).length,error.message,error.status===409 ? [{key,localValue:item.value,remoteValue:error.remoteValue}] : []);
          if(!stopped && error.status!==409) timer=window.setTimeout(() => drain().catch(() => {}),10000);
          throw error;
        }
      }
      publish('saved',0);
    })().finally(() => { inFlight=null; });
    return inFlight;
  }
  const schedule = (key,value,deleted=false) => {
    const previous=pending[key];
    pending[key]={value,deleted,expectedValue:previous ? previous.expectedValue : baseline[key] ?? null};
    persist(); publish(navigator.onLine ? 'saving' : 'offline',Object.keys(pending).length);
    clearTimeout(timer); timer=window.setTimeout(() => drain().catch(() => {}),250);
  };
  const oldSet=Storage.prototype.setItem, oldRemove=Storage.prototype.removeItem;
  const syncedSet=function(key,value) {
    const result=oldSet.call(this,key,value);
    if(this===localStorage && String(key).startsWith(prefix)) schedule(String(key),String(value));
    return result;
  };
  const syncedRemove=function(key) { const result=oldRemove.call(this,key); if(this===localStorage && String(key).startsWith(prefix)) schedule(String(key),null,true); return result; };
  Storage.prototype.setItem=syncedSet; Storage.prototype.removeItem=syncedRemove;
  const resolve = async (key,choice) => {
    const item=pending[key]; if(!item)return;
    const latest=await request('/'); const remoteValue=latest.items?.[key] ?? null;
    // Retain both versions locally before either explicit resolution.
    const archiveKey=`plothour_conflicts_${userId}`;
    let archive=[];try{archive=JSON.parse(localStorage.getItem(archiveKey)||'[]');}catch{}
    originalSet.call(localStorage,archiveKey,JSON.stringify([...archive,{key,localValue:item.value,remoteValue,at:new Date().toISOString()}].slice(-20)));
    baseline[key]=remoteValue;
    if(choice==='server') {
      delete pending[key]; persist();
      if(remoteValue===null)originalRemove.call(localStorage,key);else applyRemoteItem(key,remoteValue);
      window.dispatchEvent(new Event('storage')); window.dispatchEvent(new Event('studyduel:timer-storage'));
    } else if(choice==='local') pending[key]={...item,expectedValue:remoteValue};
    else throw new Error('Choose a version to keep.');
    await drain();
  };
  activeResolve=resolve;
  const flush=() => drain(); activeFlush=flush;
  const online=() => drain().catch(() => {});
  const remoteChanged=event => { for(const [key,value] of Object.entries(event.detail || {})) if(key.startsWith(prefix)) baseline[key]=value; };
  window.addEventListener('online',online); window.addEventListener('plothour:remote-items',remoteChanged);
  if(Object.keys(pending).length) drain().catch(() => {}); else publish('saved',0);
  return () => {
    stopped=true; clearTimeout(timer); window.removeEventListener('online',online); window.removeEventListener('plothour:remote-items',remoteChanged);
    if(Storage.prototype.setItem===syncedSet) Storage.prototype.setItem=oldSet;
    if(Storage.prototype.removeItem===syncedRemove) Storage.prototype.removeItem=oldRemove;
    if(activeFlush===flush) activeFlush=async()=>{};
    if(activeResolve===resolve) activeResolve=async()=>{};
    drain().catch(() => {});
  };
}
