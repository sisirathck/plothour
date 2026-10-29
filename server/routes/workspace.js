import { Router } from 'express';
import { pool, query } from '../db.js';
import { authenticate } from '../middleware.js';
import { syncWorkspaceProjection } from '../workspaceProjection.js';

export const workspaceRouter = Router();
workspaceRouter.use(authenticate);

const workspacePrefix = (userId) => `studyduel_user_${userId}_`;

function validWorkspaceItems(items, userId) {
  if (!items || typeof items !== 'object' || Array.isArray(items)) return false;
  const entries = Object.entries(items);
  if (entries.length > 1000) return false;
  let totalBytes = 0;
  return entries.every(([key, value]) => (
    key.startsWith(workspacePrefix(userId)) &&
    key.length <= 240 &&
    typeof value === 'string' &&
    Buffer.byteLength(value, 'utf8') <= 1_000_000 &&
    ((totalBytes += Buffer.byteLength(value, 'utf8')) <= 8_000_000)
  ));
}

workspaceRouter.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT data FROM user_workspace_state WHERE user_id = $1`,
      [req.userId]
    );
    return res.json({ initialized: result.rows.length > 0, items: result.rows[0]?.data || {} });
  } catch (err) {
    console.error('[Workspace GET Error]:', err);
    return res.status(500).json({ error: 'Failed to load workspace data' });
  }
});

// Import browser data once for accounts created before server persistence was
// added. If another browser initialized the account first, return its version.
workspaceRouter.put('/import', async (req, res) => {
  const { items = {} } = req.body || {};
  if (!validWorkspaceItems(items, req.userId)) {
    return res.status(400).json({ error: 'Invalid workspace data' });
  }

  // An empty browser must not claim initialization before another device has
  // had a chance to import its existing local workspace.
  if (Object.keys(items).length === 0) {
    return res.json({ initialized: false, imported: false, items: {} });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [req.userId]);
    const inserted = await client.query(
      `INSERT INTO user_workspace_state (user_id, data)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (user_id) DO NOTHING
       RETURNING data`,
      [req.userId, JSON.stringify(items)]
    );
    const data = inserted.rows[0]?.data ?? (await client.query(
      `SELECT data FROM user_workspace_state WHERE user_id = $1`,
      [req.userId]
    )).rows[0]?.data ?? {};
    await syncWorkspaceProjection(client, req.userId, data);
    await client.query('COMMIT');
    return res.json({ initialized: true, imported: inserted.rows.length > 0, items: data });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Workspace Import Error]:', err);
    return res.status(500).json({ error: 'Failed to import workspace data' });
  } finally { client.release(); }
});

workspaceRouter.put('/item', async (req, res) => {
  const { key, value } = req.body || {};
  if(key===`studyduel_user_${req.userId}_active_timer`)return res.status(409).json({error:'Timers now sync through the timer service. Refresh the app before changing a timer.'});
  const items = { [key]: value };
  if (!validWorkspaceItems(items, req.userId)) {
    return res.status(400).json({ error: 'Invalid workspace item' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [req.userId]);
    const before=(await client.query('SELECT data FROM user_workspace_state WHERE user_id=$1 FOR UPDATE',[req.userId])).rows[0]?.data || {};
    if (Object.hasOwn(req.body, 'expectedValue')) {
      const saved = await client.query('SELECT data ->> $2::text AS value FROM user_workspace_state WHERE user_id=$1', [req.userId,key]);
      if ((saved.rows[0]?.value ?? null) !== req.body.expectedValue && saved.rows[0]?.value !== value) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'This data changed on another device. Your changes are kept locally. Choose which version to keep.', currentValue: saved.rows[0]?.value ?? null });
      }
    }
    await client.query(
      `INSERT INTO user_workspace_state (user_id, data)
       VALUES ($1, jsonb_build_object($2::text, $3::text))
       ON CONFLICT (user_id) DO UPDATE
       SET data = user_workspace_state.data || EXCLUDED.data,
           updated_at = now()`,
      [req.userId, key, value]
    );
    await syncWorkspaceProjection(client, req.userId, { [key]: value }, key);
    if(key===`studyduel_user_${req.userId}_time_entries`) {
      const previous=JSON.parse(before[key] || '[]'),next=JSON.parse(value);
      if(!Array.isArray(previous)||!Array.isArray(next))throw new Error('Invalid session list');
      const kept=new Set(next.map(entry=>entry.id));
      const removed=previous.map(entry=>entry.id).filter(id=>!kept.has(id)&&/^[\da-f-]{36}$/i.test(id));
      if(removed.length)await client.query('DELETE FROM time_entries WHERE user_id=$1 AND id=ANY($2::uuid[])',[req.userId,removed]);
    }

    await client.query('COMMIT');
    return res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Workspace Item PUT Error]:', err);
    return res.status(500).json({ error: 'Failed to save workspace data' });
  } finally { client.release(); }
});

workspaceRouter.delete('/item', async (req, res) => {
  const { key } = req.body || {};
  if (typeof key !== 'string' || !key.startsWith(workspacePrefix(req.userId)) || key.length > 240) {
    return res.status(400).json({ error: 'Invalid workspace item' });
  }

  try {
    await query(
      `UPDATE user_workspace_state
       SET data = data - $2::text, updated_at = now()
       WHERE user_id = $1`,
      [req.userId, key]
    );
    return res.json({ success: true });
  } catch (err) {
    console.error('[Workspace Item DELETE Error]:', err);
    return res.status(500).json({ error: 'Failed to remove workspace data' });
  }
});
