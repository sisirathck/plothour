// Only the extension can request these same-origin, authenticated app actions.
// Google credentials and the app's HTTP-only cookie never leave the app tab.
const ext = typeof chrome !== 'undefined' ? chrome : browser;
const allowedRequests = new Set(['GET /auth/me','GET /projects','GET /timer/active','GET /timer/entries','POST /timer/start','POST /timer/stop','POST /timer/pause','POST /timer/resume']);
let syncing = Promise.resolve();
async function request(path,method='GET',body) {
  const response=await fetch(`/api${path}`,{method,credentials:'same-origin',headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
  return {status:response.status,data:await response.json().catch(()=>({}))};
}
async function synchronizeWorkspace(timerResult, readOnly = false) {
  const account=await request('/auth/me');
  if(account.status!==200 || !account.data.user?.id)return;
  const prefix=`studyduel_user_${account.data.user.id}_`;
  const workspace=await request('/workspace');
  if(workspace.status!==200)return;
  const items=workspace.data.items || {};
  const activeKey=prefix+'active_timer',entriesKey=prefix+'time_entries';
  if(readOnly && items[activeKey]!==JSON.stringify(timerResult.activeTimer)) {
    const latest=await request('/timer/active');
    if(latest.status===200)Object.assign(timerResult,latest.data);
  }
  const activeValue=JSON.stringify(timerResult.activeTimer);
  const patch={[activeKey]:activeValue};
  // Older deployments save API timers separately from the web workspace. Merge
  // confirmed server entries without truncating the user's existing history.
  if(!timerResult.workspaceSynced && items[activeKey]!==activeValue) {
    const recent=await request('/timer/entries');
    let entries=[];try{entries=JSON.parse(items[entriesKey] || '[]');}catch{}
    if(recent.status===200 && Array.isArray(recent.data.entries)) {
      const byId=new Map(entries.map(entry=>[entry.id,entry]));
      for(const entry of recent.data.entries)byId.set(entry.id,{...byId.get(entry.id),...entry});
      patch[entriesKey]=JSON.stringify([...byId.values()].sort((a,b)=>b.startedAt-a.startedAt));
    }
    for(const [key,value]of Object.entries(patch))if(items[key]!==value){
      const saved=await request('/workspace/item','PUT',{key,value,expectedValue:items[key] ?? null});
      if(saved.status>=400)throw new Error('The timer is saved, but the app workspace could not refresh. Reopen the app and refresh the extension.');
    }
  } else if(items[entriesKey])patch[entriesKey]=items[entriesKey];
  let changed=false;
  for(const [key,value]of Object.entries(patch))if(localStorage.getItem(key)!==value){localStorage.setItem(key,value);changed=true;}
  if(changed){window.dispatchEvent(new Event('studyduel:timer-storage'));window.dispatchEvent(new Event('storage'));}
}
ext.runtime.onMessage.addListener((message,sender,respond) => {
  if(sender.id!==ext.runtime.id || message.type!=='AUTHENTICATED_REQUEST')return false;
  const method=message.method || 'GET';
  if(!allowedRequests.has(`${method} ${message.path}`)){respond({status:403,data:{error:'This action is not available to the timer extension.'}});return false;}
  (async()=>{
    const result=await request(message.path,method,message.body ? JSON.parse(message.body) : undefined);
    if(result.status<400 && message.path.startsWith('/timer/') && Object.hasOwn(result.data,'activeTimer')){
      syncing=syncing.catch(()=>{}).then(()=>synchronizeWorkspace(result.data,method==='GET'));
      try{await syncing;}catch(error){result.data.syncWarning=error.message;}
    }
    respond(result);
  })().catch(()=>respond({status:503,data:{error:'Could not reach the app. Keep the PlotHour tab open and retry.'}}));
  return true;
});
