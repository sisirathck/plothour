import { Router } from 'express';
import { query } from '../db.js';
import { authenticate } from '../middleware.js';

export const analyticsRouter = Router();

analyticsRouter.post('/page-time', authenticate, async (req, res) => {
  const { page, durationSeconds } = req.body || {};
  const validPages = new Set(['timer', 'dashboard', 'compare', 'manage', 'settings', 'calendar', 'admin']);
  if (!validPages.has(page) || !Number.isInteger(durationSeconds) || durationSeconds < 1 || durationSeconds > 30) {
    return res.status(400).json({ error: 'Invalid page activity.' });
  }

  try {
    await query(
      `INSERT INTO user_page_activity (user_id, page, activity_date, duration_seconds, last_seen_at)
       VALUES ($1, $2, current_date, $3, now())
       ON CONFLICT (user_id, page, activity_date) DO UPDATE
       SET duration_seconds = user_page_activity.duration_seconds + EXCLUDED.duration_seconds,
           last_seen_at = now()`,
      [req.userId, page, durationSeconds]
    );
    return res.status(204).end();
  } catch (error) {
    console.error('[Page activity record error]:', error.message);
    return res.status(500).json({ error: 'Could not record page activity.' });
  }
});
