/**
 * PlotHour Browser Extension - Background Service Worker
 * Compatible with Chrome, Brave, Safari, Edge (Manifest V3)
 */

const ext = typeof chrome !== 'undefined' ? chrome : browser;

// Storage keys
const STORAGE_KEYS = {
  ACTIVE_TIMER: 'studyduel_active_timer',
  USER: 'studyduel_user',
  TOKEN: 'studyduel_token',
  PROJECTS: 'studyduel_projects',
  ENTRIES: 'studyduel_time_entries',
  SETTINGS: 'studyduel_settings',
};

// Format elapsed time for browser action badge (e.g., '14m', '1.5h')
function formatBadgeText(seconds) {
  if (seconds < 60) return '●';
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hours = (mins / 60).toFixed(1);
  return `${hours.replace(/\.0$/, '')}h`;
}

// Update the extension toolbar icon badge
async function updateBadge() {
  try {
    const data = await ext.storage.local.get([STORAGE_KEYS.ACTIVE_TIMER]);
    const active = data[STORAGE_KEYS.ACTIVE_TIMER];

    if (active && active.startedAt) {
      const elapsedSeconds = Math.max(0, Math.floor((Date.now() - active.startedAt) / 1000));
      const badgeText = formatBadgeText(elapsedSeconds);

      await ext.action.setBadgeText({ text: badgeText });
      await ext.action.setBadgeBackgroundColor({ color: '#f3957f' }); // PlotHour Warm Coral
      if (ext.action.setBadgeTextColor) {
        await ext.action.setBadgeTextColor({ color: '#ffffff' });
      }
      await ext.action.setTitle({
        title: `PlotHour: Running on "${active.projectName}${active.subjectName ? ` - ${active.subjectName}` : ''}" (${badgeText})`,
      });
    } else {
      await ext.action.setBadgeText({ text: '' });
      await ext.action.setTitle({ title: 'PlotHour Time Tracker - Click to start' });
    }
  } catch (err) {
    console.error('[PlotHour BG] Badge update error:', err);
  }
}

// Alarms for background ticker (updates toolbar badge every 30s)
ext.alarms.create('badge_tick', { periodInMinutes: 0.5 });
ext.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'badge_tick') {
    updateBadge();
  }
});

// Broadcast state change to all open PlotHour web tabs
async function notifyTabs(message) {
  try {
    const tabs = await ext.tabs.query({
      url: ['http://localhost:*/*', 'http://127.0.0.1:*/*'],
    });
    for (const tab of tabs) {
      ext.tabs.sendMessage(tab.id, message).catch(() => {});
    }
  } catch (err) {
    console.warn('[PlotHour BG] Tab notification warning:', err);
  }
}

// Handle runtime messages from popup and content scripts
ext.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.type === 'START_TIMER') {
    (async () => {
      const activeTimer = {
        projectId: req.projectId,
        projectName: req.projectName,
        subjectId: req.subjectId || '',
        subjectName: req.subjectName || '',
        color: req.color || '#10b981',
        note: req.note || '',
        startedAt: req.startedAt || Date.now(),
      };

      await ext.storage.local.set({ [STORAGE_KEYS.ACTIVE_TIMER]: activeTimer });
      await updateBadge();
      await notifyTabs({ type: 'TIMER_STARTED', activeTimer });
      sendResponse({ success: true, activeTimer });
    })();
    return true; // Keep channel open for async response
  }

  if (req.type === 'STOP_TIMER') {
    (async () => {
      const data = await ext.storage.local.get([STORAGE_KEYS.ACTIVE_TIMER, STORAGE_KEYS.ENTRIES]);
      const active = data[STORAGE_KEYS.ACTIVE_TIMER];
      const now = Date.now();

      if (active) {
        const dur = Math.max(1, Math.floor((now - active.startedAt) / 1000));
        const newEntry = {
          id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : String(now),
          ...active,
          endedAt: now,
          durationSeconds: dur,
        };

        const prevEntries = Array.isArray(data[STORAGE_KEYS.ENTRIES]) ? data[STORAGE_KEYS.ENTRIES] : [];
        await ext.storage.local.set({
          [STORAGE_KEYS.ACTIVE_TIMER]: null,
          [STORAGE_KEYS.ENTRIES]: [newEntry, ...prevEntries].slice(0, 100),
        });

        await updateBadge();
        await notifyTabs({ type: 'TIMER_STOPPED', entry: newEntry });
        sendResponse({ success: true, entry: newEntry });
      } else {
        await ext.storage.local.set({ [STORAGE_KEYS.ACTIVE_TIMER]: null });
        await updateBadge();
        sendResponse({ success: true, entry: null });
      }
    })();
    return true;
  }

  if (req.type === 'SYNC_FROM_WEBAPP') {
    (async () => {
      if (req.activeTimer) {
        await ext.storage.local.set({ [STORAGE_KEYS.ACTIVE_TIMER]: req.activeTimer });
      } else if (req.activeTimer === null) {
        await ext.storage.local.set({ [STORAGE_KEYS.ACTIVE_TIMER]: null });
      }
      if (req.projects && Array.isArray(req.projects)) {
        await ext.storage.local.set({ [STORAGE_KEYS.PROJECTS]: req.projects });
      }
      if (req.user) {
        await ext.storage.local.set({ [STORAGE_KEYS.USER]: req.user });
      }
      await updateBadge();
      sendResponse({ success: true });
    })();
    return true;
  }

  if (req.type === 'OPEN_WEBAPP') {
    (async () => {
      const targetPath = req.path || '/dashboard';
      const origin = req.origin || 'http://localhost:5173';
      const fullUrl = `${origin}${targetPath}`;

      const tabs = await ext.tabs.query({ url: `${origin}/*` });
      if (tabs.length > 0) {
        await ext.tabs.update(tabs[0].id, { active: true, url: fullUrl });
        if (tabs[0].windowId) {
          await ext.windows.update(tabs[0].windowId, { focused: true });
        }
      } else {
        await ext.tabs.create({ url: fullUrl });
      }
      sendResponse({ success: true });
    })();
    return true;
  }
});

// Initialize badge state on install or startup
ext.runtime.onInstalled.addListener(() => {
  updateBadge();
});
ext.runtime.onStartup.addListener(() => {
  updateBadge();
});
