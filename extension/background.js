const ext = typeof chrome !== 'undefined' ? chrome : browser;
let mutation = Promise.resolve();
function validOrigin(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) throw new Error('Use HTTPS, or a localhost address for development.');
  return url.origin;
}
async function connection() { const data = await ext.storage.local.get(['studyduel_server_url','studyduel_token','studyduel_tab_id','studyduel_connect_paused']); return { origin: data.studyduel_server_url || 'https://plothour.com', token: data.studyduel_token, tabId: data.studyduel_tab_id, paused: data.studyduel_connect_paused }; }
async function api(path, options = {}, config) {
  const { origin, token, tabId } = config || await connection();
  if(!token && tabId) {
    let result;
    try { result=await ext.tabs.sendMessage(tabId,{type:'AUTHENTICATED_REQUEST',path,method:options.method || 'GET',body:options.body}); }
    catch {throw new Error('Open your PlotHour tab and reconnect your browser session.');}
    if(!result || result.status>=400)throw new Error(result?.data?.error || 'Your app session ended. Sign in to PlotHour again.');
    if(result.data.syncWarning) result.data.warning=result.data.syncWarning;
    return result.data;
  }
  let response;
  for (let attempt=0; attempt<2; attempt++) {
    try { response = await fetch(`${validOrigin(origin)}/api${path}`, { credentials: 'omit', ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, signal: AbortSignal.timeout(15000) }); break; }
    catch(error) { if(attempt===1 || !path.startsWith('/timer/')) throw error; }
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}
async function badge(activeTimer) {
  const seconds = activeTimer ? Math.max(0, Math.floor(((activeTimer.pausedAt || Date.now()) - activeTimer.startedAt) / 1000 - (activeTimer.pausedSeconds || 0))) : 0;
  await ext.action.setBadgeText({ text: activeTimer ? activeTimer.pausedAt ? 'Ⅱ' : seconds < 60 ? '●' : seconds < 3600 ? `${Math.floor(seconds / 60)}m` : `${(seconds / 3600).toFixed(1)}h` : '' });
  await ext.action.setBadgeBackgroundColor({ color: '#746eac' });
}
async function saveTimer(activeTimer) { await ext.storage.local.set({ studyduel_active_timer: activeTimer }); await badge(activeTimer); }
async function getState() {
  const config = await connection();
  if(config.paused) return {origin:config.origin,user:null,projects:[],activeTimer:null};
  if (!config.token && !config.tabId) {
    try { await connectTab(); return getState(); }
    catch { return { origin: config.origin, user: null, projects: [], activeTimer: null }; }
  }
  const [account, projects, timer] = await Promise.all([api('/auth/me'), api('/projects'), api('/timer/active')]);
  await saveTimer(timer.activeTimer);
  return { origin: config.origin, user: account.user, projects: projects.projects, activeTimer: timer.activeTimer, warning: timer.warning || timer.syncWarning };
}
async function connectTab() {
  const config=await connection();
  const tabs=await ext.tabs.query({url:['http://localhost/*','http://127.0.0.1/*','https://plothour.com/*','https://www.plothour.com/*',`${validOrigin(config.origin)}/*`]});
  for(const tab of tabs.sort((a,b)=>Number(b.active)-Number(a.active))) {
    try {
      const result=await ext.tabs.sendMessage(tab.id,{type:'AUTHENTICATED_REQUEST',path:'/auth/me',method:'GET'});
      if(result?.status!==200 || !result.data?.user)continue;
      const origin=validOrigin(tab.url);
      await ext.storage.local.remove(['studyduel_token']);
      await ext.storage.local.set({studyduel_server_url:origin,studyduel_tab_id:tab.id,studyduel_connect_paused:false});
      return {origin,user:result.data.user};
    }catch{}
  }
  throw new Error('Open PlotHour in this browser and sign in first, then reconnect. If the app was already open when you installed the extension, reload that app tab once.');
}
async function handle(req) {
  if (req.type === 'LOGIN') {
    const origin = validOrigin(req.origin);
    const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email: req.email, password: req.password }) }, { origin });
    if (!data.token || !data.user) throw new Error('This server did not return an authenticated session.');
    await ext.storage.local.remove(['studyduel_tab_id']);
    await ext.storage.local.set({ studyduel_server_url: origin, studyduel_token: data.token,studyduel_connect_paused:false });
    return { origin, user: data.user };
  }
  if (req.type === 'GET_STATE') return getState();
  if (req.type === 'CONNECT_TAB') return connectTab();
  if (req.type === 'SET_SERVER') {
    const origin=validOrigin(req.origin);
    await ext.storage.local.remove(['studyduel_token','studyduel_tab_id','studyduel_connect_paused']);
    await ext.storage.local.set({studyduel_server_url:origin,studyduel_connect_paused:true});
    return {origin,user:null,projects:[],activeTimer:null};
  }
  if (req.type === 'GOOGLE_LOGIN') {
    const {origin}=await connection();
    const tab=await ext.tabs.create({url:`${validOrigin(origin)}/login?extension=1`});
    await ext.storage.local.remove(['studyduel_token']);
    if(tab?.id) await ext.storage.local.set({studyduel_tab_id:tab.id,studyduel_connect_paused:false});
    return {origin};
  }
  if (req.type === 'START_TIMER' || req.type === 'STOP_TIMER') {
    const result = await api(`/timer/${req.type === 'START_TIMER' ? 'start' : 'stop'}`, { method: 'POST', body: JSON.stringify({ projectId: req.projectId, subjectId: req.subjectId, expectedStartedAt: req.expectedStartedAt, commandId: crypto.randomUUID() }) });
    await saveTimer(result.activeTimer);
    return result;
  }
  if (req.type === 'LOGOUT') { await ext.storage.local.set({studyduel_connect_paused:true}); await ext.storage.local.remove(['studyduel_tab_id','studyduel_token','studyduel_user','studyduel_projects','studyduel_time_entries']); await saveTimer(null); return {}; }
  if (req.type === 'OPEN_WEBAPP') { const { origin } = await connection(); await ext.tabs.create({ url: `${validOrigin(origin)}${['/timer','/manage'].includes(req.path) ? req.path : '/timer'}` }); return {}; }
  throw new Error('Unknown extension action.');
}
ext.runtime.onMessage.addListener((req, sender, reply) => {
  // Only extension pages may trigger account and timer actions.
  if (sender.tab || !sender.url?.startsWith(ext.runtime.getURL(''))) return false;
  const execute = () => handle(req).then(data => reply({ ...data, success: true })).catch(error => reply({ success: false, error: error.message }));
  mutation = mutation.then(execute, execute);
  return true;
});
ext.alarms.create('timer-refresh', { periodInMinutes: .5 });
ext.alarms.onAlarm.addListener(() => getState().catch(() => {}));
ext.runtime.onStartup.addListener(() => getState().catch(() => {}));
