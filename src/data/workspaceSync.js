const userWorkspacePrefix = (userId) => `studyduel_user_${userId}_`;

function readLocalWorkspace(prefix) {
  const items = {};
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith(prefix)) items[key] = localStorage.getItem(key) ?? '';
  }
  return items;
}

function applyRemoteWorkspace(prefix, items) {
  const keysToRemove = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith(prefix)) keysToRemove.push(key);
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key));
  Object.entries(items || {}).forEach(([key, value]) => {
    if (key.startsWith(prefix) && typeof value === 'string') localStorage.setItem(key, value);
  });
}

async function requestWorkspace(path, options) {
  const response = await fetch(`/api/workspace${path}`, {
    credentials: 'same-origin',
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  if (!response.ok) throw new Error(`Workspace sync failed (${response.status})`);
  return response.json();
}

/** Load server state, importing this browser's existing data once if needed,
 * then sync account-scoped localStorage writes back to the server. */
export async function connectWorkspaceSync(userId) {
  const prefix = userWorkspacePrefix(userId);
  const local = window.localStorage;
  const setItem = Storage.prototype.setItem;
  const removeItem = Storage.prototype.removeItem;

  let remote = await requestWorkspace('/', { method: 'GET' });
  if (!remote.initialized) {
    remote = await requestWorkspace('/import', {
      method: 'PUT',
      body: JSON.stringify({ items: readLocalWorkspace(prefix) }),
    });
  }
  applyRemoteWorkspace(prefix, remote.items);

  const pendingWrites = new Map();
  const flushKey = async (key) => {
    const pending = pendingWrites.get(key);
    if (!pending) return;
    window.clearTimeout(pending.timeoutId);
    pendingWrites.delete(key);
    try {
      if (pending.deleted) {
        await requestWorkspace('/item', { method: 'DELETE', body: JSON.stringify({ key }) });
      } else {
        await requestWorkspace('/item', {
          method: 'PUT',
          body: JSON.stringify({ key, value: pending.value }),
        });
      }
    } catch (error) {
      console.error('[Workspace sync] Could not save workspace data:', error.message);
    }
  };
  const queueWrite = (key, value, deleted = false) => {
    const existing = pendingWrites.get(key);
    if (existing) window.clearTimeout(existing.timeoutId);
    const timeoutId = window.setTimeout(() => { flushKey(key); }, 180);
    pendingWrites.set(key, { value, deleted, timeoutId });
  };

  Storage.prototype.setItem = function syncedSetItem(key, value) {
    const result = setItem.call(this, key, value);
    if (this === local && String(key).startsWith(prefix)) queueWrite(String(key), String(value));
    return result;
  };
  Storage.prototype.removeItem = function syncedRemoveItem(key) {
    const result = removeItem.call(this, key);
    if (this === local && String(key).startsWith(prefix)) queueWrite(String(key), null, true);
    return result;
  };

  return () => {
    if (Storage.prototype.setItem !== setItem) Storage.prototype.setItem = setItem;
    if (Storage.prototype.removeItem !== removeItem) Storage.prototype.removeItem = removeItem;
    [...pendingWrites.keys()].forEach((key) => { flushKey(key); });
  };
}
