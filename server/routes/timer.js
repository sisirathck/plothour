import { Router } from 'express';
import { query } from '../db.js';
import { authenticate } from '../middleware.js';

export const timerRouter = Router();

timerRouter.use(authenticate);

/**
 * Get active timer for user
 */
timerRouter.get('/active', async (req, res) => {
  try {
    const result = await query(
      `SELECT a.user_id, a.project_id, a.subproject_id, a.started_at, a.note,
              p.name AS project_name, p.color AS project_color,
              s.name AS subject_name, s.color AS subject_color
       FROM active_timers a
       JOIN projects p ON p.id = a.project_id
       LEFT JOIN subprojects s ON s.id = a.subproject_id
       WHERE a.user_id = $1`,
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.json({ activeTimer: null });
    }

    const row = result.rows[0];
    return res.json({
      activeTimer: {
        projectId: row.project_id,
        projectName: row.project_name,
        subjectId: row.subproject_id || '',
        subjectName: row.subject_name || '',
        color: row.subject_color || row.project_color || '#10b981',
        startedAt: new Date(row.started_at).getTime(),
        note: row.note || '',
      },
    });
  } catch (err) {
    console.error('[Timer Active GET Error]:', err);
    return res.status(500).json({ error: 'Failed to fetch active timer' });
  }
});

/**
 * Start or switch active timer
 */
timerRouter.post('/start', async (req, res) => {
  const { projectId, subjectId = null, note = '' } = req.body;

  if (!projectId) {
    return res.status(400).json({ error: 'Project ID is required to start a timer' });
  }

  try {
    // 1. Verify project belongs to user
    const pCheck = await query(
      `SELECT id, name, color FROM projects WHERE id = $1 AND user_id = $2`,
      [projectId, req.userId]
    );
    if (pCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const project = pCheck.rows[0];

    let subjectName = '';
    let subjectColor = project.color;
    if (subjectId) {
      const sCheck = await query(
        `SELECT id, name, color FROM subprojects WHERE id = $1 AND project_id = $2`,
        [subjectId, projectId]
      );
      if (sCheck.rows.length > 0) {
        subjectName = sCheck.rows[0].name;
        subjectColor = sCheck.rows[0].color || project.color;
      }
    }

    const now = new Date();

    // 2. Check if a timer was already active. If so, close it and record time_entry
    const existingActive = await query(
      `SELECT user_id, project_id, subproject_id, started_at, note
       FROM active_timers
       WHERE user_id = $1`,
      [req.userId]
    );

    if (existingActive.rows.length > 0) {
      const oldTimer = existingActive.rows[0];
      const startedAt = new Date(oldTimer.started_at);
      if (now > startedAt) {
        await query(
          `INSERT INTO time_entries (user_id, project_id, subproject_id, started_at, ended_at, note, source)
           VALUES ($1, $2, $3, $4, $5, $6, 'timer')`,
          [req.userId, oldTimer.project_id, oldTimer.subproject_id, startedAt, now, oldTimer.note || '']
        );
      }
    }

    // 3. Upsert active timer
    await query(
      `INSERT INTO active_timers (user_id, project_id, subproject_id, started_at, note)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id) DO UPDATE SET
         project_id = EXCLUDED.project_id,
         subproject_id = EXCLUDED.subproject_id,
         started_at = EXCLUDED.started_at,
         note = EXCLUDED.note`,
      [req.userId, projectId, subjectId || null, now, note || '']
    );

    return res.json({
      activeTimer: {
        projectId: project.id,
        projectName: project.name,
        subjectId: subjectId || '',
        subjectName,
        color: subjectColor || '#10b981',
        startedAt: now.getTime(),
        note: note || '',
      },
    });
  } catch (err) {
    console.error('[Timer Start Error]:', err);
    return res.status(500).json({ error: 'Failed to start timer' });
  }
});

/**
 * Stop active timer
 */
timerRouter.post('/stop', async (req, res) => {
  try {
    const existing = await query(
      `SELECT a.user_id, a.project_id, a.subproject_id, a.started_at, a.note,
              p.name AS project_name, p.color AS project_color,
              s.name AS subject_name, s.color AS subject_color
       FROM active_timers a
       JOIN projects p ON p.id = a.project_id
       LEFT JOIN subprojects s ON s.id = a.subproject_id
       WHERE a.user_id = $1`,
      [req.userId]
    );

    if (existing.rows.length === 0) {
      return res.json({ activeTimer: null, entry: null });
    }

    const timer = existing.rows[0];
    const startedAt = new Date(timer.started_at);
    const endedAt = new Date();
    const durationSeconds = Math.max(1, Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000));

    // Insert entry
    const entryRes = await query(
      `INSERT INTO time_entries (user_id, project_id, subproject_id, started_at, ended_at, note, source)
       VALUES ($1, $2, $3, $4, $5, $6, 'timer')
       RETURNING id, started_at, ended_at, note`,
      [req.userId, timer.project_id, timer.subproject_id, startedAt, endedAt, timer.note || '']
    );

    // Remove active timer
    await query(`DELETE FROM active_timers WHERE user_id = $1`, [req.userId]);

    return res.json({
      activeTimer: null,
      entry: {
        id: entryRes.rows[0].id,
        projectId: timer.project_id,
        projectName: timer.project_name,
        subjectId: timer.subproject_id || '',
        subjectName: timer.subject_name || '',
        color: timer.subject_color || timer.project_color || '#10b981',
        startedAt: startedAt.getTime(),
        endedAt: endedAt.getTime(),
        durationSeconds,
        note: timer.note || '',
      },
    });
  } catch (err) {
    console.error('[Timer Stop Error]:', err);
    return res.status(500).json({ error: 'Failed to stop timer' });
  }
});

/**
 * Get recent time entries
 */
timerRouter.get('/entries', async (req, res) => {
  try {
    const result = await query(
      `SELECT e.id, e.project_id, e.subproject_id, e.started_at, e.ended_at, e.note, e.source,
              p.name AS project_name, p.color AS project_color,
              s.name AS subject_name, s.color AS subject_color,
              ROUND(EXTRACT(EPOCH FROM (e.ended_at - e.started_at)))::integer AS duration_seconds
       FROM time_entries e
       JOIN projects p ON p.id = e.project_id
       LEFT JOIN subprojects s ON s.id = e.subproject_id
       WHERE e.user_id = $1
       ORDER BY e.started_at DESC
       LIMIT 50`,
      [req.userId]
    );

    const entries = result.rows.map((r) => ({
      id: r.id,
      projectId: r.project_id,
      projectName: r.project_name,
      subjectId: r.subproject_id || '',
      subjectName: r.subject_name || '',
      color: r.subject_color || r.project_color || '#10b981',
      startedAt: new Date(r.started_at).getTime(),
      endedAt: new Date(r.ended_at).getTime(),
      durationSeconds: r.duration_seconds || 0,
      note: r.note || '',
    }));

    return res.json({ entries });
  } catch (err) {
    console.error('[Timer Entries GET Error]:', err);
    return res.status(500).json({ error: 'Failed to fetch entries' });
  }
});
