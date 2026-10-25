/**
 * PlotHour Browser Extension - Popup Logic
 * Aligned with PlotHour Web App Design System & Data Layer
 */

// Universal Extension API wrapper with standalone preview fallback
const ext = (typeof chrome !== 'undefined' && chrome.storage)
  ? chrome
  : (typeof browser !== 'undefined' && browser.storage)
    ? browser
    : {
        storage: {
          local: {
            get: async (keys) => {
              const res = {};
              const keyList = Array.isArray(keys) ? keys : [keys];
              for (const k of keyList) {
                try {
                  const val = localStorage.getItem(k);
                  if (val !== null) res[k] = JSON.parse(val);
                } catch {
                  res[k] = null;
                }
              }
              return res;
            },
            set: async (obj) => {
              for (const [k, v] of Object.entries(obj)) {
                localStorage.setItem(k, JSON.stringify(v));
              }
            },
            remove: async (keys) => {
              const keyList = Array.isArray(keys) ? keys : [keys];
              keyList.forEach((k) => localStorage.removeItem(k));
            },
          },
          onChanged: { addListener: () => {} },
        },
        action: {
          setBadgeText: async () => {},
          setBadgeBackgroundColor: async () => {},
          setTitle: async () => {},
        },
        tabs: {
          query: async () => [],
          create: async () => {},
          update: async () => {},
          sendMessage: async () => {},
        },
        runtime: {
          sendMessage: (msg, cb) => { if (cb) cb({ success: true }); },
          onMessage: { addListener: () => {} },
        },
      };

// Default Sample Projects (from PlotHour TimerPage)
const DEFAULT_PROJECTS = [
  {
    id: 'cs',
    name: 'Computer Science',
    color: '#f3957f',
    subjects: [
      { id: 'algo', name: 'Algorithms', color: '#f3957f' },
      { id: 'ds', name: 'Data Structures', color: '#e07a5f' },
      { id: 'sys', name: 'System Design', color: '#f4a261' },
    ],
  },
  {
    id: 'math',
    name: 'Mathematics',
    color: '#818cf8',
    subjects: [
      { id: 'calc', name: 'Calculus III', color: '#818cf8' },
      { id: 'lin', name: 'Linear Algebra', color: '#6366f1' },
    ],
  },
  {
    id: 'lang',
    name: 'Languages',
    color: '#34d399',
    subjects: [
      { id: 'jp', name: 'Japanese', color: '#34d399' },
      { id: 'de', name: 'German', color: '#10b981' },
    ],
  },
];

// App State
let state = {
  user: null,
  token: null,
  theme: 'dark',
  serverUrl: 'http://localhost:5173',
  projects: DEFAULT_PROJECTS,
  activeTimer: null,
  timeEntries: [],
  selectedTask: null,
  isOnline: true,
};

let clockInterval = null;

// Helpers
const pad = (n) => String(Math.floor(n)).padStart(2, '0');
const fmtClock = (s) => `${pad(s / 3600)}:${pad((s % 3600) / 60)}:${pad(s % 60)}`;
const fmtTime12 = (d = new Date()) => {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).toLowerCase();
};
const fmtDur = (s) => {
  if (!s || s <= 0) return '0m';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

// PlotHour Harmonic Sound Synthesizer (528Hz & 1056Hz from TimerPage.jsx)
function playStudyDuelChime(type = 'start') {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') ctx.resume();

    const startedAt = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'sine';

    if (type === 'start') {
      osc1.frequency.setValueAtTime(528, startedAt);
      osc2.frequency.setValueAtTime(1056, startedAt);
      gain1.gain.setValueAtTime(0.18, startedAt);
      gain1.gain.exponentialRampToValueAtTime(0.0001, startedAt + 0.6);
      gain2.gain.setValueAtTime(0.06, startedAt);
      gain2.gain.exponentialRampToValueAtTime(0.0001, startedAt + 0.6);
      osc1.start(startedAt);
      osc2.start(startedAt);
      osc1.stop(startedAt + 0.6);
      osc2.stop(startedAt + 0.6);
    } else {
      osc1.frequency.setValueAtTime(1056, startedAt);
      osc1.frequency.exponentialRampToValueAtTime(528, startedAt + 0.8);
      gain1.gain.setValueAtTime(0.2, startedAt);
      gain1.gain.exponentialRampToValueAtTime(0.0001, startedAt + 0.8);
      osc1.start(startedAt);
      osc1.stop(startedAt + 0.8);
    }

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    if (type === 'start') {
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
    }
  } catch {}
}

// Show Toast
function showToast(msg, duration = 3000) {
  const toast = document.getElementById('toast');
  const msgEl = document.getElementById('toast-message');
  if (!toast || !msgEl) return;
  msgEl.textContent = msg;
  toast.style.display = 'block';
  setTimeout(() => {
    toast.style.display = 'none';
  }, duration);
}

// Switch Views
function showView(viewName) {
  const views = ['login', 'main', 'create'];
  views.forEach((v) => {
    const el = document.getElementById(`view-${v}`);
    if (el) el.classList.toggle('active', v === viewName);
  });

  if (viewName === 'create') {
    initCreateView();
  }
}

// Theme Management
function applyTheme(themeName) {
  state.theme = themeName;
  document.documentElement.setAttribute('data-theme', themeName);

  const logoImg = document.getElementById('sd-logo-img');
  const sunIcon = document.getElementById('theme-icon-sun');
  const moonIcon = document.getElementById('theme-icon-moon');

  if (themeName === 'light') {
    if (logoImg) logoImg.src = 'assets/plothour_logo_light.png';
    if (sunIcon) sunIcon.style.display = 'none';
    if (moonIcon) moonIcon.style.display = 'block';
  } else {
    if (logoImg) logoImg.src = 'assets/plothour_logo_dark.png';
    if (sunIcon) sunIcon.style.display = 'block';
    if (moonIcon) moonIcon.style.display = 'none';
  }

  ext.storage.local.set({ studyduel_theme: themeName });
}

// Initialize Application
async function init() {
  setupEventListeners();

  const data = await ext.storage.local.get([
    'studyduel_theme',
    'studyduel_user',
    'studyduel_token',
    'studyduel_server_url',
    'studyduel_projects',
    'studyduel_active_timer',
    'studyduel_time_entries',
  ]);

  // Set Theme
  if (data.studyduel_theme) {
    applyTheme(data.studyduel_theme);
  } else {
    applyTheme('dark');
  }

  if (data.studyduel_server_url) {
    state.serverUrl = data.studyduel_server_url;
    const inputUrl = document.getElementById('input-server-url');
    if (inputUrl) inputUrl.value = state.serverUrl;
  }

  if (data.studyduel_projects && Array.isArray(data.studyduel_projects) && data.studyduel_projects.length) {
    state.projects = data.studyduel_projects;
  }

  if (data.studyduel_active_timer) {
    state.activeTimer = data.studyduel_active_timer;
  }

  if (data.studyduel_time_entries) {
    state.timeEntries = data.studyduel_time_entries;
  }

  if (data.studyduel_user) {
    state.user = data.studyduel_user;
    state.token = data.studyduel_token || null;
    showView('main');
    renderMainView();
    syncWithBackend();
  } else {
    checkOpenStudyDuelTabs();
    showView('login');
  }

  startClockTick();
}

// Check for active PlotHour tabs for 1-click connect
async function checkOpenStudyDuelTabs() {
  try {
    const tabs = await ext.tabs.query({ url: ['http://localhost:*/*', 'http://127.0.0.1:*/*'] });
    const banner = document.getElementById('quick-connect-banner');
    if (tabs.length > 0 && banner) {
      banner.style.display = 'flex';
      const qcText = document.getElementById('qc-text');
      if (qcText) qcText.textContent = `Open tab found: ${tabs[0].title || 'PlotHour'}`;
    }
  } catch (err) {}
}

// Sync with Backend API
async function syncWithBackend() {
  if (!state.token && !state.user) return;

  const apiUrl = state.serverUrl.replace(/\/$/, '');
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers['Authorization'] = `Bearer ${state.token}`;

  try {
    const timerRes = await fetch(`${apiUrl}/api/timer/active`, { headers, credentials: 'include' });
    if (timerRes.ok) {
      const timerData = await timerRes.json();
      if (timerData.activeTimer !== undefined) {
        state.activeTimer = timerData.activeTimer;
        await ext.storage.local.set({ studyduel_active_timer: state.activeTimer });
        renderMainView();
      }
    }

    const projRes = await fetch(`${apiUrl}/api/projects`, { headers, credentials: 'include' });
    if (projRes.ok) {
      const projData = await projRes.json();
      if (projData.projects && projData.projects.length) {
        state.projects = projData.projects;
        await ext.storage.local.set({ studyduel_projects: state.projects });
      }
    }

    const entRes = await fetch(`${apiUrl}/api/timer/entries`, { headers, credentials: 'include' });
    if (entRes.ok) {
      const entData = await entRes.json();
      if (entData.entries) {
        state.timeEntries = entData.entries;
        await ext.storage.local.set({ studyduel_time_entries: state.timeEntries });
      }
    }

    updateStatusIndicator(true);
  } catch (err) {
    updateStatusIndicator(false);
  }
}

function updateStatusIndicator(isOnline) {
  state.isOnline = isOnline;
  const label = document.getElementById('sd-status-text');
  const dot = document.getElementById('sd-status-dot');
  if (state.activeTimer) {
    if (label) label.textContent = 'RECORDING';
    if (dot) dot.className = 'sd-badge-dot live';
  } else {
    if (label) label.textContent = isOnline ? 'READY' : 'OFFLINE';
    if (dot) dot.className = isOnline ? 'sd-badge-dot live' : 'sd-badge-dot';
  }
}

// Render Main Command Deck (View 1)
function renderMainView() {
  const idleBox = document.getElementById('sd-idle-box');
  const runningBox = document.getElementById('sd-running-box');
  const playBtn = document.getElementById('btn-primary-action');
  const playIcon = document.getElementById('play-icon-svg');
  const stopIcon = document.getElementById('stop-icon-svg');

  // Profile Avatar Initials
  const initials = state.user?.display_name
    ? state.user.display_name.slice(0, 2).toUpperCase()
    : (state.user?.email ? state.user.email[0].toUpperCase() : 'SD');
  document.getElementById('avatar-initials').textContent = initials;
  document.getElementById('popover-initials').textContent = initials;
  document.getElementById('popover-name').textContent = state.user?.display_name || 'PlotHour User';
  document.getElementById('popover-email').textContent = state.user?.email || 'demo@plothour.local';

  // Calculate Today's Time
  const todayStr = new Date().toDateString();
  const todaySecs = state.timeEntries
    .filter((e) => new Date(e.startedAt).toDateString() === todayStr)
    .reduce((acc, e) => acc + (e.durationSeconds || 0), 0);
  const todaySessions = state.timeEntries.filter((e) => new Date(e.startedAt).toDateString() === todayStr).length;

  document.getElementById('sd-today-summary-label').textContent = `Today · ${fmtDur(todaySecs)}`;
  document.getElementById('pstat-today-time').textContent = fmtDur(todaySecs);
  document.getElementById('pstat-today-sessions').textContent = String(todaySessions);

  if (state.activeTimer && state.activeTimer.startedAt) {
    // RUNNING SESSION
    idleBox.style.display = 'none';
    runningBox.style.display = 'block';

    const dot = document.getElementById('running-dot');
    dot.style.backgroundColor = state.activeTimer.color || '#f3957f';
    dot.style.color = state.activeTimer.color || '#f3957f';

    document.getElementById('running-project-name').textContent = state.activeTimer.projectName;
    const subEl = document.getElementById('running-subject-name');
    const sepEl = document.getElementById('running-sep');
    if (state.activeTimer.subjectName) {
      subEl.textContent = state.activeTimer.subjectName;
      subEl.style.display = 'inline';
      sepEl.style.display = 'inline';
    } else {
      subEl.style.display = 'none';
      sepEl.style.display = 'none';
    }

    const notePreview = document.getElementById('running-note-preview');
    const noteText = document.getElementById('running-note-text');
    if (state.activeTimer.note && state.activeTimer.note.trim()) {
      noteText.textContent = state.activeTimer.note;
      notePreview.style.display = 'flex';
    } else {
      notePreview.style.display = 'none';
    }

    const startD = new Date(state.activeTimer.startedAt);
    document.getElementById('running-started-at').textContent = `Started at ${fmtTime12(startD)}`;

    playBtn.classList.add('is-running');
    playBtn.title = 'Stop Running Session';
    playIcon.style.display = 'none';
    stopIcon.style.display = 'block';

    updateStatusIndicator(state.isOnline);
  } else {
    // IDLE
    idleBox.style.display = 'flex';
    runningBox.style.display = 'none';

    playBtn.classList.remove('is-running');
    playBtn.title = 'Start Session';
    playIcon.style.display = 'block';
    stopIcon.style.display = 'none';

    updateStatusIndicator(state.isOnline);
  }

  renderFrequentCombos();
}

// Render Top 4 Frequent Combos (Matching PlotHour TimerPage topCombos)
function getTopCombos() {
  const counts = new Map();
  const activeProjects = state.projects || [];

  state.timeEntries.forEach((e) => {
    const k = `${e.projectId}::${e.subjectId || ''}`;
    const existing = counts.get(k) || {
      projectId: e.projectId,
      projectName: e.projectName,
      subjectId: e.subjectId || '',
      subjectName: e.subjectName || '',
      color: e.color || '#f3957f',
      count: 0,
    };
    existing.count += 1;
    counts.set(k, existing);
  });

  const list = Array.from(counts.values()).sort((a, b) => b.count - a.count);

  // If fewer than 4 from history, populate from projects/subjects
  if (list.length < 4 && activeProjects.length > 0) {
    const usedKeys = new Set(list.map((c) => `${c.projectId}::${c.subjectId}`));
    for (const p of activeProjects) {
      if (p.subjects && p.subjects.length > 0) {
        for (const s of p.subjects) {
          const k = `${p.id}::${s.id}`;
          if (!usedKeys.has(k)) {
            usedKeys.add(k);
            list.push({
              projectId: p.id,
              projectName: p.name,
              subjectId: s.id,
              subjectName: s.name,
              color: s.color || p.color || '#f3957f',
              count: 0,
            });
            if (list.length >= 4) break;
          }
        }
      } else {
        const k = `${p.id}::`;
        if (!usedKeys.has(k)) {
          usedKeys.add(k);
          list.push({
            projectId: p.id,
            projectName: p.name,
            subjectId: '',
            subjectName: '',
            color: p.color || '#f3957f',
            count: 0,
          });
        }
      }
      if (list.length >= 4) break;
    }
  }

  return list.slice(0, 4);
}

function renderFrequentCombos() {
  const container = document.getElementById('sd-combos-list');
  if (!container) return;
  container.innerHTML = '';

  const combos = getTopCombos();
  combos.forEach((combo, idx) => {
    const item = document.createElement('div');
    item.className = 'sd-combo-item';
    item.innerHTML = `
      <div class="sd-combo-left">
        <span class="sd-combo-rank">0${idx + 1}</span>
        <span class="sd-tag-dot" style="background:${combo.color || '#f3957f'}; width:7px; height:7px;"></span>
        <div class="sd-combo-text">
          <span class="sd-combo-proj">${combo.projectName}</span>
          ${combo.subjectName ? `<span class="sd-combo-sub">${combo.subjectName}</span>` : ''}
        </div>
      </div>
      <button type="button" class="sd-combo-btn">Start</button>
    `;

    // 1-Click quick start on combo
    item.addEventListener('click', () => {
      startSessionDirectly(combo);
    });

    container.appendChild(item);
  });
}

// Clock Tick
function startClockTick() {
  if (clockInterval) clearInterval(clockInterval);
  clockInterval = setInterval(() => {
    if (state.activeTimer && state.activeTimer.startedAt) {
      const elapsed = Math.max(0, Math.floor((Date.now() - state.activeTimer.startedAt) / 1000));
      const clockEl = document.getElementById('running-clock');
      if (clockEl) clockEl.textContent = fmtClock(elapsed);
    }
  }, 1000);
}

// Initialize Create View (View 2)
function initCreateView() {
  if (!state.selectedTask) {
    const firstProj = state.projects[0] || DEFAULT_PROJECTS[0];
    const firstSub = firstProj.subjects?.[0];
    state.selectedTask = {
      projectId: firstProj.id,
      projectName: firstProj.name,
      subjectId: firstSub?.id || '',
      subjectName: firstSub?.name || '',
      color: firstSub?.color || firstProj.color || '#f3957f',
    };
  }

  updateSelectedTaskDisplay();

  document.getElementById('metric-start-time').value = fmtTime12(new Date());
  document.getElementById('metric-stop-time').value = 'Running';
  document.getElementById('metric-duration').value = '00h 00m';

  const noteInput = document.getElementById('timer-note-input');
  noteInput.value = '';
  document.getElementById('note-char-counter').textContent = '0/1024';
}

function updateSelectedTaskDisplay() {
  const dot = document.getElementById('selected-task-dot');
  const text = document.getElementById('selected-task-text');
  if (!state.selectedTask) return;

  dot.style.backgroundColor = state.selectedTask.color || '#f3957f';
  if (state.selectedTask.subjectName) {
    text.textContent = `${state.selectedTask.projectName} › ${state.selectedTask.subjectName}`;
  } else {
    text.textContent = state.selectedTask.projectName;
  }
}

// Open Searchable Task Picker Modal (View 3)
function openTaskPicker() {
  const modal = document.getElementById('task-picker-modal');
  const searchInput = document.getElementById('picker-search-input');
  searchInput.value = '';
  document.getElementById('btn-clear-search').style.display = 'none';

  renderPickerItems('');
  modal.style.display = 'flex';
  searchInput.focus();
}

function closeTaskPicker() {
  document.getElementById('task-picker-modal').style.display = 'none';
}

function renderPickerItems(query = '') {
  const q = query.trim().toLowerCase();

  // 1. Suggested Section
  const suggContainer = document.getElementById('suggested-items-container');
  suggContainer.innerHTML = '';
  const topList = getTopCombos();
  const filteredSugg = topList.filter((s) =>
    !q || `${s.projectName} ${s.subjectName}`.toLowerCase().includes(q)
  );

  document.getElementById('suggested-section').style.display = filteredSugg.length ? 'block' : 'none';

  filteredSugg.forEach((item) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sd-suggested-btn';
    btn.innerHTML = `
      <span class="sd-tag-dot" style="background:${item.color || '#f3957f'}; width:8px; height:8px;"></span>
      <span>${item.projectName}${item.subjectName ? ` › ${item.subjectName}` : ''}</span>
    `;
    btn.addEventListener('click', () => {
      selectTaskFromPicker(item);
    });
    suggContainer.appendChild(btn);
  });

  // 2. Project Hierarchy
  const treeContainer = document.getElementById('projects-tree-container');
  treeContainer.innerHTML = '';

  state.projects.forEach((proj) => {
    const subjects = proj.subjects || [];
    const projMatch = !q || proj.name.toLowerCase().includes(q);
    const matchingSubs = subjects.filter((s) => !q || s.name.toLowerCase().includes(q));

    if (!projMatch && !matchingSubs.length) return;

    const branch = document.createElement('div');
    branch.className = 'sd-project-branch';

    const projBtn = document.createElement('button');
    projBtn.type = 'button';
    projBtn.className = 'sd-proj-header-btn';
    projBtn.innerHTML = `
      <span class="sd-tag-dot" style="background:${proj.color || '#f3957f'}"></span>
      <span>${proj.name}</span>
    `;
    projBtn.addEventListener('click', () => {
      selectTaskFromPicker({
        projectId: proj.id,
        projectName: proj.name,
        subjectId: '',
        subjectName: '',
        color: proj.color || '#f3957f',
      });
    });
    branch.appendChild(projBtn);

    const subTree = document.createElement('div');
    subTree.className = 'sd-subtasks-tree';

    const subsToRender = projMatch ? subjects : matchingSubs;
    subsToRender.forEach((sub) => {
      const subBtn = document.createElement('button');
      subBtn.type = 'button';
      subBtn.className = 'sd-subtask-btn';
      subBtn.innerHTML = `
        <span class="sd-tag-dot" style="background:${sub.color || proj.color || '#f3957f'}; width:6px; height:6px;"></span>
        <span>${sub.name}</span>
      `;
      subBtn.addEventListener('click', () => {
        selectTaskFromPicker({
          projectId: proj.id,
          projectName: proj.name,
          subjectId: sub.id,
          subjectName: sub.name,
          color: sub.color || proj.color || '#f3957f',
        });
      });
      subTree.appendChild(subBtn);
    });

    branch.appendChild(subTree);
    treeContainer.appendChild(branch);
  });
}

function selectTaskFromPicker(task) {
  state.selectedTask = task;
  updateSelectedTaskDisplay();
  closeTaskPicker();
}

// Direct 1-Click Start (from combo)
async function startSessionDirectly(task) {
  const startTime = Date.now();
  const newActive = {
    projectId: task.projectId,
    projectName: task.projectName,
    subjectId: task.subjectId || '',
    subjectName: task.subjectName || '',
    color: task.color || '#f3957f',
    note: '',
    startedAt: startTime,
  };

  ext.runtime.sendMessage({
    type: 'START_TIMER',
    ...newActive,
  });

  state.activeTimer = newActive;
  await ext.storage.local.set({ studyduel_active_timer: newActive });

  if (state.token) {
    const apiUrl = state.serverUrl.replace(/\/$/, '');
    fetch(`${apiUrl}/api/timer/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.token}`,
      },
      body: JSON.stringify({
        projectId: newActive.projectId,
        subjectId: newActive.subjectId || null,
        note: '',
      }),
    }).catch(() => {});
  }

  playStudyDuelChime('start');
  showToast(`Session Started: ${newActive.projectName}`);
  renderMainView();
}

// Start Session from Create View
async function handleStartTimer() {
  if (!state.selectedTask) {
    showToast('Please select a project or subject');
    return;
  }

  const note = document.getElementById('timer-note-input').value.trim();
  const startTime = Date.now();

  const newActive = {
    projectId: state.selectedTask.projectId,
    projectName: state.selectedTask.projectName,
    subjectId: state.selectedTask.subjectId || '',
    subjectName: state.selectedTask.subjectName || '',
    color: state.selectedTask.color || '#f3957f',
    note,
    startedAt: startTime,
  };

  ext.runtime.sendMessage({
    type: 'START_TIMER',
    ...newActive,
  });

  state.activeTimer = newActive;
  await ext.storage.local.set({ studyduel_active_timer: newActive });

  if (state.token) {
    const apiUrl = state.serverUrl.replace(/\/$/, '');
    fetch(`${apiUrl}/api/timer/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.token}`,
      },
      body: JSON.stringify({
        projectId: newActive.projectId,
        subjectId: newActive.subjectId || null,
        note,
      }),
    }).catch(() => {});
  }

  playStudyDuelChime('start');
  showToast('Session Started');
  showView('main');
  renderMainView();
}

// Stop Running Session
async function handleStopTimer() {
  if (!state.activeTimer) return;

  ext.runtime.sendMessage({ type: 'STOP_TIMER' });

  if (state.token) {
    const apiUrl = state.serverUrl.replace(/\/$/, '');
    fetch(`${apiUrl}/api/timer/stop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.token}`,
      },
      body: JSON.stringify({}),
    }).catch(() => {});
  }

  const completed = state.activeTimer;
  state.activeTimer = null;
  await ext.storage.local.set({ studyduel_active_timer: null });

  playStudyDuelChime('stop');
  showToast(`Session Logged · ${completed.projectName}`);
  renderMainView();
}

// Event Listeners Setup
function setupEventListeners() {
  // Theme Toggle
  document.getElementById('btn-theme-toggle').addEventListener('click', () => {
    const nextTheme = state.theme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
  });

  // Navigation
  document.getElementById('btn-back-from-create').addEventListener('click', () => {
    showView('main');
  });

  document.getElementById('btn-cancel-create').addEventListener('click', () => {
    showView('main');
  });

  // Primary Action Button (Main View Coral Play Button)
  document.getElementById('btn-primary-action').addEventListener('click', () => {
    if (state.activeTimer) {
      handleStopTimer();
    } else {
      showView('create');
    }
  });

  // Quick Stop inside active timer box
  document.getElementById('btn-quick-stop').addEventListener('click', () => {
    handleStopTimer();
  });

  // Start timer confirm in Create View
  document.getElementById('btn-start-timer-confirm').addEventListener('click', () => {
    handleStartTimer();
  });

  // Open Timesheet Dashboard button
  document.getElementById('btn-go-timesheet').addEventListener('click', () => {
    ext.runtime.sendMessage({
      type: 'OPEN_WEBAPP',
      origin: state.serverUrl,
      path: '/dashboard',
    });
  });

  // Task selector button -> opens searchable modal
  document.getElementById('btn-open-task-picker').addEventListener('click', () => {
    openTaskPicker();
  });

  // Close task picker
  document.getElementById('btn-close-picker').addEventListener('click', () => {
    closeTaskPicker();
  });

  // Picker search input
  const searchInput = document.getElementById('picker-search-input');
  const clearSearchBtn = document.getElementById('btn-clear-search');
  searchInput.addEventListener('input', (e) => {
    const val = e.target.value;
    clearSearchBtn.style.display = val ? 'block' : 'none';
    renderPickerItems(val);
  });
  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearSearchBtn.style.display = 'none';
    renderPickerItems('');
    searchInput.focus();
  });

  // Quick Add Project
  const toggleQuickAdd = document.getElementById('btn-toggle-quick-add');
  const quickAddForm = document.getElementById('quick-add-form');
  toggleQuickAdd.addEventListener('click', () => {
    quickAddForm.style.display = quickAddForm.style.display === 'none' ? 'flex' : 'none';
  });

  document.getElementById('btn-cancel-add-project').addEventListener('click', () => {
    quickAddForm.style.display = 'none';
  });

  document.getElementById('btn-confirm-add-project').addEventListener('click', async () => {
    const input = document.getElementById('new-project-name');
    const name = input.value.trim();
    if (!name) return;

    const newProj = {
      id: `proj_${Date.now()}`,
      name,
      color: '#f3957f',
      subjects: [],
    };

    state.projects = [newProj, ...state.projects];
    await ext.storage.local.set({ studyduel_projects: state.projects });

    if (state.token) {
      const apiUrl = state.serverUrl.replace(/\/$/, '');
      fetch(`${apiUrl}/api/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${state.token}`,
        },
        body: JSON.stringify({ name, color: '#f3957f' }),
      }).catch(() => {});
    }

    input.value = '';
    quickAddForm.style.display = 'none';
    renderPickerItems(searchInput.value);
    showToast(`Project "${name}" added`);
  });

  // Note character counter
  const noteInput = document.getElementById('timer-note-input');
  noteInput.addEventListener('input', (e) => {
    document.getElementById('note-char-counter').textContent = `${e.target.value.length}/1024`;
  });

  // Profile Avatar popover
  const avatarBtn = document.getElementById('btn-profile-avatar');
  const profilePopover = document.getElementById('profile-popover');
  avatarBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    profilePopover.style.display = profilePopover.style.display === 'none' ? 'block' : 'none';
  });

  document.addEventListener('click', (e) => {
    if (!profilePopover.contains(e.target) && e.target !== avatarBtn) {
      profilePopover.style.display = 'none';
    }
  });

  document.getElementById('btn-popover-open-app').addEventListener('click', () => {
    ext.runtime.sendMessage({
      type: 'OPEN_WEBAPP',
      origin: state.serverUrl,
      path: '/dashboard',
    });
    profilePopover.style.display = 'none';
  });

  document.getElementById('btn-popover-logout').addEventListener('click', async () => {
    state.user = null;
    state.token = null;
    await ext.storage.local.remove(['studyduel_user', 'studyduel_token']);
    profilePopover.style.display = 'none';
    showView('login');
  });

  // Login Form Submission
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    const submitBtn = document.getElementById('btn-submit-login');
    const spinner = submitBtn.querySelector('.btn-spinner');
    const btnText = submitBtn.querySelector('.btn-text');

    errorEl.style.display = 'none';
    spinner.style.display = 'block';
    btnText.style.display = 'none';
    submitBtn.disabled = true;

    try {
      const apiUrl = state.serverUrl.replace(/\/$/, '');
      const res = await fetch(`${apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed. Please verify email and password.');
      }

      state.user = data.user;
      state.token = data.token || null;
      await ext.storage.local.set({
        studyduel_user: state.user,
        studyduel_token: state.token,
      });

      showToast(`Welcome back, ${state.user.display_name}!`);
      showView('main');
      renderMainView();
      syncWithBackend();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = 'block';
    } finally {
      spinner.style.display = 'none';
      btnText.style.display = 'block';
      submitBtn.disabled = false;
    }
  });

  // Demo Mode
  document.getElementById('btn-demo-mode').addEventListener('click', async () => {
    state.user = {
      id: 'demo_user',
      display_name: 'Demo Student',
      email: 'demo@plothour.local',
    };
    state.token = 'demo_token';
    await ext.storage.local.set({
      studyduel_user: state.user,
      studyduel_token: state.token,
    });
    showToast('Logged in as Demo Student');
    showView('main');
    renderMainView();
  });

  // 1-Click Connect Tab
  document.getElementById('btn-quick-connect').addEventListener('click', async () => {
    state.user = {
      id: 'web_session_user',
      display_name: 'PlotHour User',
      email: 'account@plothour.local',
    };
    await ext.storage.local.set({ studyduel_user: state.user });
    showToast('Connected to open browser session!');
    showView('main');
    renderMainView();
  });

  // Connection settings toggle
  const toggleServer = document.getElementById('toggle-server-settings');
  const serverPanel = document.getElementById('server-settings-panel');
  const arrow = document.getElementById('server-settings-arrow');
  toggleServer.addEventListener('click', () => {
    const isHidden = serverPanel.style.display === 'none';
    serverPanel.style.display = isHidden ? 'flex' : 'none';
    arrow.textContent = isHidden ? '▴' : '▾';
  });

  document.getElementById('input-server-url').addEventListener('change', async (e) => {
    state.serverUrl = e.target.value.trim() || 'http://localhost:5173';
    await ext.storage.local.set({ studyduel_server_url: state.serverUrl });
    showToast('Host updated');
  });

  // Real-time external storage sync
  ext.storage.onChanged.addListener((changes) => {
    if (changes.studyduel_active_timer) {
      state.activeTimer = changes.studyduel_active_timer.newValue;
      renderMainView();
    }
    if (changes.studyduel_projects && changes.studyduel_projects.newValue) {
      state.projects = changes.studyduel_projects.newValue;
      renderFrequentCombos();
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
