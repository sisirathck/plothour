import { Router } from 'express';
import { randomBytes } from 'crypto';
import { query } from '../db.js';
import { authenticate } from '../middleware.js';

export const connectionsRouter = Router();
connectionsRouter.use(authenticate);

async function getOrCreateInviteCode(userId) {
  const existing = await query('SELECT code FROM user_invite_codes WHERE user_id = $1', [userId]);
  if (existing.rows[0]) return existing.rows[0].code;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = `DUEL-${randomBytes(5).toString('hex').toUpperCase()}`;
    const inserted = await query(
      `INSERT INTO user_invite_codes (user_id, code) VALUES ($1, $2)
       ON CONFLICT DO NOTHING RETURNING code`,
      [userId, code]
    );
    if (inserted.rows[0]) return inserted.rows[0].code;
    const raced = await query('SELECT code FROM user_invite_codes WHERE user_id = $1', [userId]);
    if (raced.rows[0]) return raced.rows[0].code;
  }
  throw new Error('Could not allocate a unique invite code');
}

connectionsRouter.get('/', async (req, res) => {
  try {
    const inviteCode = await getOrCreateInviteCode(req.userId);
    const friends = await query(
      `SELECT u.id, u.display_name, u.email, c.code, f.created_at
       FROM friendships f
       JOIN users u ON u.id = CASE WHEN f.user_low_id = $1 THEN f.user_high_id ELSE f.user_low_id END
       LEFT JOIN user_invite_codes c ON c.user_id = u.id
       WHERE f.user_low_id = $1 OR f.user_high_id = $1
       ORDER BY lower(u.display_name), u.id`,
      [req.userId]
    );
    return res.json({ inviteCode, connections: friends.rows.map((friend) => ({
      id: friend.id,
      name: friend.display_name,
      email: friend.email,
      code: friend.code,
      createdAt: friend.created_at,
    })) });
  } catch (error) {
    console.error('[Connections GET Error]:', error);
    return res.status(500).json({ error: 'Could not load study partners.' });
  }
});

connectionsRouter.post('/', async (req, res) => {
  const code = typeof req.body?.code === 'string' ? req.body.code.trim().toUpperCase() : '';
  if (!/^DUEL-[0-9A-F]{10}$/.test(code)) {
    return res.status(400).json({ error: 'Enter a valid PlotHour invite code.' });
  }
  try {
    const match = await query(
      `SELECT u.id, u.display_name, u.email FROM user_invite_codes c
       JOIN users u ON u.id = c.user_id WHERE c.code = $1`,
      [code]
    );
    const partner = match.rows[0];
    if (!partner) return res.status(404).json({ error: 'No account was found for that invite code.' });
    if (partner.id === req.userId) return res.status(400).json({ error: 'You cannot add your own invite code.' });
    const low = [req.userId, partner.id].sort()[0];
    const high = [req.userId, partner.id].sort()[1];
    await query(
      `INSERT INTO friendships (user_low_id, user_high_id) VALUES ($1, $2)
       ON CONFLICT (user_low_id, user_high_id) DO NOTHING`,
      [low, high]
    );
    return res.status(201).json({ connection: { id: partner.id, name: partner.display_name, email: partner.email, code } });
  } catch (error) {
    console.error('[Connections POST Error]:', error);
    return res.status(500).json({ error: 'Could not connect this study partner.' });
  }
});

connectionsRouter.delete('/:partnerId', async (req, res) => {
  try {
    await query(
      `DELETE FROM friendships WHERE user_low_id = LEAST($1::uuid, $2::uuid)
       AND user_high_id = GREATEST($1::uuid, $2::uuid)`,
      [req.userId, req.params.partnerId]
    );
    return res.json({ success: true });
  } catch (error) {
    console.error('[Connections DELETE Error]:', error);
    return res.status(500).json({ error: 'Could not remove this study partner.' });
  }
});

connectionsRouter.get('/comparison', async (req, res) => {
  const ids = [...new Set(String(req.query.profileIds || '').split(',').filter(Boolean))];
  const from = Number(req.query.from);
  const to = Number(req.query.to);
  const previousFrom = Number(req.query.previousFrom);
  const previousTo = Number(req.query.previousTo);
  const recentFrom = Number(req.query.recentFrom);
  const recentTo = Number(req.query.recentTo);
  const weekStartsOn = Number(req.query.weekStartsOn);
  const calendarDays = Number(req.query.calendarDays);
  const rangeType = String(req.query.rangeType || 'custom');
  if (ids.length < 1 || ids.length > 50 || ids.some((id) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) || !ids.includes(req.userId)
    || ![from, to].every(Number.isFinite) || from > to
    || ![previousFrom, previousTo].every(Number.isFinite)
    || ![recentFrom, recentTo].every(Number.isFinite) || recentFrom > recentTo
    || !Number.isInteger(weekStartsOn) || weekStartsOn < 0 || weekStartsOn > 6
    || !Number.isInteger(calendarDays) || calendarDays < 1 || calendarDays > 100000
    || !['today', '7days', 'week', 'month', '30days', '90days', 'all', 'custom'].includes(rangeType)) {
    return res.status(400).json({ error: 'Invalid comparison request.' });
  }
  try {
    const allowed = await query(
      `SELECT id FROM users WHERE id = $1
       UNION SELECT CASE WHEN user_low_id = $1 THEN user_high_id ELSE user_low_id END
       FROM friendships WHERE user_low_id = $1 OR user_high_id = $1`,
      [req.userId]
    );
    const allowedIds = new Set(allowed.rows.map((row) => row.id));
    if (ids.some((id) => !allowedIds.has(id))) return res.status(403).json({ error: 'You can only compare your own profile and connected study partners.' });

    const profiles = await query(
      `SELECT u.id, u.display_name, u.timezone, u.week_starts_on,
              w.data ->> ('studyduel_user_' || u.id::text || '_time_entries') AS entries_json,
              w.data ->> ('studyduel_user_' || u.id::text || '_preferences') AS preferences_json,
              w.data ->> ('studyduel_user_' || u.id::text || '_projects') AS projects_json
       FROM users u LEFT JOIN user_workspace_state w ON w.user_id = u.id
       WHERE u.id = ANY($1::uuid[])`,
      [ids]
    );
    const serializedProfiles = profiles.rows.map((profile) => {
      let storedEntries = [];
      let preferences = {};
      let projects = [];
      try { storedEntries = JSON.parse(profile.entries_json || '[]'); } catch {}
      try { preferences = JSON.parse(profile.preferences_json || '{}'); } catch {}
      try { projects = JSON.parse(profile.projects_json || '[]'); } catch {}
      const entries = (Array.isArray(storedEntries) ? storedEntries : [])
        .map((entry) => ({
          ...entry,
          startedAt: Number.isFinite(Number(entry.startedAt)) ? Number(entry.startedAt) : new Date(entry.startedAt).getTime(),
          durationSeconds: Math.max(0, Number(entry.durationSeconds) || 0),
        }))
        .filter((entry) => Number.isFinite(entry.startedAt) && entry.durationSeconds > 0);
      const dailyGoalHours = Math.max(0, Number(preferences.dailyGoalHours) || 0);
      const periodEntries = entries.filter((entry) => entry.startedAt >= from && entry.startedAt <= to);
      const previousEntries = entries.filter((entry) => entry.startedAt >= previousFrom && entry.startedAt <= previousTo);
      const dateKey = (timestamp) => {
        const date = new Date(timestamp);
        const parts = new Intl.DateTimeFormat('en-CA', {
          timeZone: profile.timezone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit',
        }).formatToParts(date);
        return `${parts.find((part) => part.type === 'year').value}-${parts.find((part) => part.type === 'month').value}-${parts.find((part) => part.type === 'day').value}`;
      };
      const dailyTotals = new Map();
      const dailySessions = new Map();
      periodEntries.forEach((entry) => {
        const key = dateKey(entry.startedAt);
        dailyTotals.set(key, (dailyTotals.get(key) || 0) + entry.durationSeconds);
        dailySessions.set(key, (dailySessions.get(key) || 0) + 1);
      });
      const dailyRows = [...dailyTotals].map(([date, seconds]) => ({ date, seconds, sessions: dailySessions.get(date) || 0 }));
      const activeDays = dailyRows.length;
      const seconds = periodEntries.reduce((sum, entry) => sum + entry.durationSeconds, 0);
      const sortedSessions = periodEntries.map((entry) => entry.durationSeconds).sort((a, b) => a - b);
      const activeDayDurations = dailyRows.map((day) => day.seconds).sort((a, b) => a - b);
      const median = (values) => values.length ? (values.length % 2
        ? values[Math.floor(values.length / 2)]
        : Math.round((values[values.length / 2 - 1] + values[values.length / 2]) / 2)) : 0;
      const longSessions = periodEntries.filter((entry) => entry.durationSeconds >= 45 * 60).length;
      const shortSessions = periodEntries.filter((entry) => entry.durationSeconds < 15 * 60).length;
      const goalDays = dailyGoalHours > 0 ? dailyRows.filter((day) => day.seconds >= dailyGoalHours * 3600).length : 0;
      const weekdaySeconds = periodEntries.filter((entry) => {
        const day = new Date(`${dateKey(entry.startedAt)}T00:00:00Z`).getUTCDay();
        return day !== 0 && day !== 6;
      }).reduce((sum, entry) => sum + entry.durationSeconds, 0);
      const weekendSeconds = seconds - weekdaySeconds;
      const previousSeconds = previousEntries.reduce((sum, entry) => sum + entry.durationSeconds, 0);
      const recentDailyTotals = new Map();
      entries.filter((entry) => entry.startedAt >= recentFrom && entry.startedAt <= recentTo).forEach((entry) => {
        const key = dateKey(entry.startedAt);
        recentDailyTotals.set(key, (recentDailyTotals.get(key) || 0) + entry.durationSeconds);
      });
      const orderedDays = [...dailyRows].sort((a, b) => a.date.localeCompare(b.date));
      const daySerial = (date) => Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 86400000);
      let longestStreak = 0;
      let streak = 0;
      let lastSerial = null;
      orderedDays.forEach((day) => {
        const serial = daySerial(day.date);
        streak = lastSerial === serial - 1 ? streak + 1 : 1;
        longestStreak = Math.max(longestStreak, streak);
        lastSerial = serial;
      });
      const periodEndDate = dateKey(to);
      const streakAtEnd = orderedDays.at(-1)?.date === periodEndDate ? streak : 0;
      const bestDay = [...orderedDays].sort((a, b) => b.seconds - a.seconds)[0] || null;
      const longestSession = [...periodEntries].sort((a, b) => b.durationSeconds - a.durationSeconds)[0] || null;
      const peakHours = new Map();
      periodEntries.forEach((entry) => {
        const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: profile.timezone || 'UTC', hour: 'numeric', hourCycle: 'h23' }).format(new Date(entry.startedAt)));
        peakHours.set(hour, (peakHours.get(hour) || 0) + entry.durationSeconds);
      });
      const peakHour = [...peakHours].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      const projectTotals = new Map();
      periodEntries.forEach((entry) => {
        const label = entry.subjectName || entry.projectName || 'General Study';
        projectTotals.set(label, (projectTotals.get(label) || 0) + entry.durationSeconds);
      });
      const activeProjects = Array.isArray(projects) ? projects.filter((project) => !project.archived) : [];
      const goalSeconds = rangeType === 'all' ? 0 : activeProjects.reduce((total, project) => total + (project.subjects || []).reduce((part, subject) => {
        const goals = subject.goals || {};
        if (rangeType === 'week') return part + (Number(goals.weekly) || 0) * 3600;
        if (rangeType === 'month') return part + (Number(goals.monthly) || 0) * 3600;
        if (rangeType === 'today') return part + (Number(goals.daily) || 0) * 3600;
        return part + (Number(goals.daily) || 0) * calendarDays * 3600;
      }, 0), 0);
      return {
        id: profile.id,
        name: profile.display_name,
        weekStartsOn: Number.isInteger(Number(profile.week_starts_on)) ? Number(profile.week_starts_on) : weekStartsOn,
        current: {
          seconds,
          activeDays,
          sessions: periodEntries.length,
          averageActiveDaySeconds: activeDays ? Math.round(seconds / activeDays) : 0,
          averageSessionSeconds: periodEntries.length ? Math.round(seconds / periodEntries.length) : 0,
        sessionsPerCalendarDay: periodEntries.length / calendarDays,
          medianActiveDaySeconds: median(activeDayDurations),
          longSessionShare: periodEntries.length ? longSessions / periodEntries.length : 0,
          shortSessions,
          thirtyMinuteDays: activeDayDurations.filter((value) => value >= 1800).length,
          goalDays,
          goalSeconds,
          goalProgressPct: goalSeconds ? Math.round(seconds / goalSeconds * 100) : null,
          weekdaySeconds,
          weekendSeconds,
          streakAtEnd,
          longestStreak,
          bestDay,
          longestSession: longestSession ? { seconds: longestSession.durationSeconds, date: dateKey(longestSession.startedAt) } : null,
          peakHour,
          projectBreakdown: [...projectTotals].map(([name, projectSeconds]) => ({ name, seconds: projectSeconds })).sort((a, b) => b.seconds - a.seconds),
        },
        previous: { seconds: previousSeconds },
        daily: dailyRows,
        recentDaily: [...recentDailyTotals].map(([date, seconds]) => ({ date, seconds })).sort((a, b) => a.date.localeCompare(b.date)),
      };
    });
    return res.json({ profiles: serializedProfiles });
  } catch (error) {
    console.error('[Comparison Data Error]:', error);
    return res.status(500).json({ error: 'Could not load comparison data.' });
  }
});
