const ext = typeof chrome !== 'undefined' ? chrome : browser;
const $ = id => document.getElementById(id);
let state = { origin: 'https://plothour.com', user: null, projects: [], activeTimer: null };
let busy = false;
const message = async (type, extra = {}) => {
  const result = await ext.runtime.sendMessage({ type, ...extra });
  if (!result?.success) throw new Error(result?.error || 'Could not connect. Please retry.');
  return result;
};
function error(error) { $('error').textContent = error?.message || ''; $('error').hidden = !error; }
function fillSubjects(selected = '') {
  const project = state.projects.find(p => p.id === $('project').value);
  $('subject').replaceChildren(new Option('No subproject', ''), ...(project?.subjects || []).map(s => new Option(s.name, s.id)));
  $('subject').value = selected;
}
function render() {
  $('login').hidden = Boolean(state.user); $('workspace').hidden = !state.user;
  $('server').value = state.origin;
  $('status').textContent = state.user ? `Connected · ${new URL(state.origin).host}` : 'Sign in or connect your browser session.';
  $('no-projects').hidden = state.projects.length > 0;
  $('account').textContent = state.user?.email || '';
  const selectedProject = $('project').value;
  const selectedSubject = $('subject').value;
  $('project').replaceChildren(new Option('Choose a project', ''), ...state.projects.map(p => new Option(p.name, p.id)));
  $('project').value = state.activeTimer?.projectId || selectedProject;
  fillSubjects(state.activeTimer?.subjectId || selectedSubject || '');
  $('running').hidden = !state.activeTimer;
  $('running-project').textContent = [state.activeTimer?.projectName, state.activeTimer?.subjectName].filter(Boolean).join(' / ');
  $('toggle').textContent = state.activeTimer ? 'Stop & save session' : 'Start timer';
  $('toggle').disabled = busy || (!state.activeTimer && !$('project').value);
  $('project').disabled = Boolean(state.activeTimer); $('subject').disabled = Boolean(state.activeTimer);
  tick();
}
function tick() {
  const active = state.activeTimer;
  const seconds = active ? Math.floor((active.pausedAt || Date.now()) / 1000 - active.startedAt / 1000 - (active.pausedSeconds || 0)) : 0;
  $('clock').textContent = [seconds / 3600, seconds % 3600 / 60, seconds % 60].map(n => String(Math.max(0, Math.floor(n))).padStart(2, '0')).join(':');
}
async function run(action) {
  if (busy) return;
  busy = true; error(null); document.querySelectorAll('button').forEach(b => { b.disabled = true; });
  try { await action(); } catch (e) { error(e); } finally { busy = false; document.querySelectorAll('button').forEach(b => { b.disabled = false; }); render(); }
}
async function refresh() { const result = await message('GET_STATE'); state = { ...state, ...result }; if(result.warning) error(new Error(result.warning)); }
$('login-form').onsubmit = event => { event.preventDefault(); run(async () => {
  const result = await message('LOGIN', { origin: $('server').value.trim(), email: $('email').value.trim(), password: $('password').value });
  state = { ...state, ...result }; $('password').value = ''; await refresh();
}); };
$('google').onclick = () => run(async () => { const result = await message('GOOGLE_LOGIN'); $('sign-in-hint').hidden=false; $('sign-in-hint').textContent='Finish Google sign-in in the PlotHour tab, then reopen this popup. Keep that app tab open while using the browser-session connection.'; state.origin=result.origin; });
$('save-server').onclick = () => run(async () => { const result=await message('SET_SERVER',{origin:$('server').value.trim()}); state={...state,...result}; await refresh(); });
$('connect').onclick = () => run(async () => { state = { ...state, ...await message('CONNECT_TAB') }; await refresh(); });
$('logout').onclick = () => run(async () => { await message('LOGOUT'); state = { ...state, user: null, projects: [], activeTimer: null }; });
$('refresh').onclick = () => run(refresh);
$('project').onchange = () => { fillSubjects(); $('toggle').disabled = !$('project').value; };
$('toggle').onclick = () => run(async () => {
  const result=await message(state.activeTimer ? 'STOP_TIMER' : 'START_TIMER', { projectId: $('project').value, subjectId: $('subject').value || null, expectedStartedAt: state.activeTimer?.startedAt || null });
  await refresh();
  if(result.warning) error(new Error(result.warning));
});
$('create-project').onclick = () => message('OPEN_WEBAPP',{path:'/manage'}).catch(error);
$('open-app').onclick = () => message('OPEN_WEBAPP').catch(error);
run(refresh);
setInterval(tick, 1000);
ext.storage.onChanged.addListener(changes => { if (changes.studyduel_active_timer && !busy) { state.activeTimer = changes.studyduel_active_timer.newValue; render(); } });
