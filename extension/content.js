/**
 * PlotHour Browser Extension - Content Script
 * Seamless bidirectional sync between the PlotHour Web App and the Browser Extension
 */

const ext = typeof chrome !== 'undefined' ? chrome : browser;

function getStorageKeys(userId) {
  return {
    projectsKey: userId ? `studyduel_user_${userId}_projects` : 'studyduel_demo_projects',
    activeKey: userId ? `studyduel_user_${userId}_active_timer` : 'studyduel_demo_active_timer',
    entriesKey: userId ? `studyduel_user_${userId}_time_entries` : 'studyduel_demo_time_entries',
  };
}

function readJson(key, fallback = null) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

// Inspect current user & timer state from PlotHour web app
async function syncFromPageToExtension() {
  try {
    // Check if web app has an active timer or projects in localStorage
    // 1. Look for user keys first
    let foundUserId = null;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      const match = k.match(/^studyduel_user_([a-zA-Z0-9_-]+)_active_timer$/);
      if (match) {
        foundUserId = match[1];
        break;
      }
    }

    const keys = getStorageKeys(foundUserId);
    const activeTimer = readJson(keys.activeKey, null);
    const projects = readJson(keys.projectsKey, null);

    ext.runtime.sendMessage({
      type: 'SYNC_FROM_WEBAPP',
      activeTimer,
      projects,
      userId: foundUserId,
    }).catch(() => {});
  } catch (err) {
    console.debug('[PlotHour Extension Content] Sync error:', err);
  }
}

// Initial sync on tab load
syncFromPageToExtension();

// Listen to changes in the web app localStorage
window.addEventListener('storage', (e) => {
  if (e.key && e.key.startsWith('studyduel_')) {
    syncFromPageToExtension();
  }
});

// Listen to StudyDuel custom events
window.addEventListener('studyduel:timer-storage', () => {
  syncFromPageToExtension();
});

// Receive updates from extension background (when timer started/stopped in popup)
ext.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'TIMER_STARTED') {
    const timer = msg.activeTimer;
    // Find active user key or demo key
    let foundUserId = null;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      const match = k.match(/^studyduel_user_([a-zA-Z0-9_-]+)_projects$/);
      if (match) {
        foundUserId = match[1];
        break;
      }
    }
    const keys = getStorageKeys(foundUserId);

    localStorage.setItem(keys.activeKey, JSON.stringify(timer));
    window.dispatchEvent(new CustomEvent('studyduel:timer-storage', { detail: { activeTimer: timer } }));
  }

  if (msg.type === 'TIMER_STOPPED') {
    const entry = msg.entry;
    let foundUserId = null;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      const match = k.match(/^studyduel_user_([a-zA-Z0-9_-]+)_projects$/);
      if (match) {
        foundUserId = match[1];
        break;
      }
    }
    const keys = getStorageKeys(foundUserId);

    localStorage.setItem(keys.activeKey, 'null');
    if (entry) {
      const entries = readJson(keys.entriesKey, []);
      localStorage.setItem(keys.entriesKey, JSON.stringify([entry, ...entries].slice(0, 100)));
    }
    window.dispatchEvent(new CustomEvent('studyduel:timer-storage', { detail: { activeTimer: null, entry } }));
  }
});
