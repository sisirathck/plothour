import { Router } from 'express';
import { pool, query } from '../db.js';
import { authenticate } from '../middleware.js';
import { isAdminEmail } from '../auth.js';
import {
  hashVerificationCode,
  newVerificationCode,
  sendPasswordResetEmail,
} from './auth.js';

export const adminRouter = Router();

const validAssetSlots = new Set(['login', 'dashboard', 'logo']);
const validThemes = new Set(['light', 'dark']);
const validFontIds = new Set(['nunito', 'quicksand', 'poppins', 'rubik', 'comfortaa', 'inter', 'roboto', 'open-sans', 'source-sans-3', 'ibm-plex-sans', 'noto-sans']);
const customizablePages = ['login', 'timer', 'dashboard', 'manage', 'compare', 'settings', 'calendar', 'admin'];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cleanCustomization = (value) => {
  const input = value && typeof value === 'object' ? value : {};
  const copy = {};
  if (input.copy && typeof input.copy === 'object') {
    for (const [page, fields] of Object.entries(input.copy)) {
      if (!['login', 'timer', 'manage', 'compare', 'dashboard'].includes(page) || !fields || typeof fields !== 'object') continue;
      copy[page] = {};
      for (const [key, text] of Object.entries(fields)) {
        if (typeof text === 'string' && text.length <= 240) copy[page][key] = text.trim();
      }
    }
  }
  const visuals = { login: { light: [], dark: [], shuffle: true }, dashboard: { light: [], dark: [], shuffle: true }, logo: { light: null, dark: null } };
  for (const slot of ['login', 'dashboard']) {
    const source = input.visuals?.[slot] || {};
    for (const theme of validThemes) {
      const ids = Array.isArray(source[theme]) ? source[theme] : [];
      visuals[slot][theme] = [...new Set(ids.filter((id) => typeof id === 'string' && uuidPattern.test(id)))].slice(0, 24);
    }
    visuals[slot].shuffle = source.shuffle !== false;
  }
  for (const theme of validThemes) {
    const id = input.visuals?.logo?.[theme];
    visuals.logo[theme] = typeof id === 'string' && uuidPattern.test(id) ? id : null;
  }
  const fonts = Object.fromEntries(customizablePages.map((page) => [
    page,
    validFontIds.has(input.fonts?.[page]) ? input.fonts[page] : 'inter',
  ]));
  return { copy, visuals, fonts };
};

adminRouter.get('/customization', async (_req, res) => {
  try {
    const [config, assets] = await Promise.all([
      query('SELECT config, updated_at FROM site_customization WHERE id = 1'),
      query('SELECT id, slot, theme, file_name, mime_type, byte_size, created_at FROM site_assets ORDER BY created_at DESC'),
    ]);
    return res.json({ config: cleanCustomization(config.rows[0]?.config), updatedAt: config.rows[0]?.updated_at || null, assets: assets.rows });
  } catch (error) {
    console.error('[Admin customization load error]:', error);
    return res.status(500).json({ error: 'Could not load site customization.' });
  }
});

adminRouter.put('/customization', async (req, res) => {
  const config = cleanCustomization(req.body?.config);
  try {
    const result = await query(
      `INSERT INTO site_customization (id, config, updated_at, updated_by)
       VALUES (1, $1::jsonb, now(), $2)
       ON CONFLICT (id) DO UPDATE SET config = EXCLUDED.config, updated_at = now(), updated_by = EXCLUDED.updated_by
       RETURNING config, updated_at`,
      [JSON.stringify(config), req.userId]
    );
    return res.json({ config: result.rows[0].config, updatedAt: result.rows[0].updated_at });
  } catch (error) {
    console.error('[Admin customization save error]:', error);
    return res.status(500).json({ error: 'Could not save site customization.' });
  }
});

adminRouter.post('/assets', async (req, res) => {
  const { slot, theme, fileName, mimeType, data } = req.body || {};
  if (!validAssetSlots.has(slot) || !validThemes.has(theme)) return res.status(400).json({ error: 'Choose a valid asset type and theme.' });
  if (typeof fileName !== 'string' || fileName.length > 180 || typeof data !== 'string') return res.status(400).json({ error: 'Choose a valid image file.' });
  const match = data.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match || match[1] !== mimeType) return res.status(400).json({ error: 'Upload a PNG, JPG, or WebP image.' });
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > 5 * 1024 * 1024) return res.status(400).json({ error: 'Images must be 5 MB or smaller.' });
  const signatures = {
    'image/png': bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    'image/jpeg': bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
    'image/webp': bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP',
  };
  if (!signatures[mimeType]) return res.status(400).json({ error: 'The file content does not match its image type.' });
  try {
    const count = await query('SELECT count(*)::int AS count FROM site_assets WHERE slot = $1 AND theme = $2', [slot, theme]);
    if (count.rows[0].count >= (slot === 'logo' ? 4 : 24)) return res.status(409).json({ error: 'This image collection is full. Remove an image before uploading another.' });
    const result = await query(
      `INSERT INTO site_assets (slot, theme, file_name, mime_type, file_data, byte_size, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, slot, theme, file_name, mime_type, byte_size, created_at`,
      [slot, theme, fileName.split(/[\\/]/).pop().slice(0, 180), mimeType, bytes, bytes.length, req.userId]
    );
    return res.status(201).json({ asset: result.rows[0] });
  } catch (error) {
    console.error('[Admin asset upload error]:', error);
    return res.status(500).json({ error: 'Could not save the image.' });
  }
});

adminRouter.delete('/assets/:assetId', async (req, res) => {
  if (!uuidPattern.test(req.params.assetId)) return res.status(400).json({ error: 'Invalid image.' });
  try {
    const result = await query('SELECT config FROM site_customization WHERE id = 1');
    const config = cleanCustomization(result.rows[0]?.config);
    for (const slot of ['login', 'dashboard']) for (const theme of validThemes) {
      config.visuals[slot][theme] = config.visuals[slot][theme].filter((id) => id !== req.params.assetId);
    }
    for (const theme of validThemes) if (config.visuals.logo[theme] === req.params.assetId) config.visuals.logo[theme] = null;
    await query('DELETE FROM site_assets WHERE id = $1', [req.params.assetId]);
    await query('UPDATE site_customization SET config = $1::jsonb, updated_at = now(), updated_by = $2 WHERE id = 1', [JSON.stringify(config), req.userId]);
    return res.json({ deleted: true, config });
  } catch (error) {
    console.error('[Admin asset delete error]:', error);
    return res.status(500).json({ error: 'Could not remove the image.' });
  }
});

adminRouter.use(authenticate);
adminRouter.use(async (req, res, next) => {
  try {
    const result = await query(
      'SELECT email, email_verified FROM users WHERE id = $1',
      [req.userId]
    );
    const user = result.rows[0];
    if (!user || !user.email_verified || !isAdminEmail(user.email)) {
      return res.status(403).json({ error: 'Administrator access is required.' });
    }
    req.adminEmail = user.email;
    next();
  } catch (error) {
    console.error('[Admin authorization error]:', error);
    return res.status(500).json({ error: 'Could not verify administrator access.' });
  }
});

adminRouter.get('/overview', async (_req, res) => {
  try {
    const [counts, settings] = await Promise.all([
      query(`SELECT
        (SELECT count(*)::int FROM users) AS total_users,
        (SELECT count(*)::int FROM users WHERE email_verified) AS verified_users,
        (SELECT count(*)::int FROM users WHERE created_at >= now() - interval '30 days') AS new_users_30d,
        (SELECT count(*)::int FROM time_entries) AS total_sessions,
        (SELECT coalesce(sum(extract(epoch FROM (ended_at - started_at))), 0)::bigint FROM time_entries) AS total_study_seconds`),
      query(`SELECT signups_enabled, updated_at FROM app_admin_settings WHERE id = 1`),
    ]);
    return res.json({
      stats: counts.rows[0],
      settings: settings.rows[0] || { signups_enabled: true, updated_at: null },
    });
  } catch (error) {
    console.error('[Admin overview error]:', error);
    return res.status(500).json({ error: 'Could not load admin overview.' });
  }
});

adminRouter.get('/users', async (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 120) : '';
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
  const offset = Math.max(0, Number.parseInt(req.query.offset, 10) || 0);
  const status = ['all', 'verified', 'pending'].includes(req.query.status) ? req.query.status : 'all';
  const loginActivity = ['all', 'has', 'none'].includes(req.query.loginActivity) ? req.query.loginActivity : 'all';
  const studyActivity = ['all', 'has', 'none'].includes(req.query.studyActivity) ? req.query.studyActivity : 'all';
  const pageActivity = ['all', 'has', 'none'].includes(req.query.pageActivity) ? req.query.pageActivity : 'all';
  const validDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ? value : null;
  const joinedFrom = validDate(req.query.joinedFrom);
  const joinedTo = validDate(req.query.joinedTo);
  const sortColumns = { account: 'lower(u.display_name)', status: 'u.email_verified', logins: 'coalesce(l.login_count, 0)', study: 'coalesce(s.study_seconds, 0)', appTime: 'coalesce(p.app_seconds, 0)', joined: 'u.created_at' };
  const sortColumn = sortColumns[req.query.sortBy] || sortColumns.joined;
  const sortDirection = req.query.sortDir === 'asc' ? 'ASC' : 'DESC';
  const pattern = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
  const filterParams = [search, pattern, status, loginActivity, studyActivity, pageActivity, joinedFrom, joinedTo];
  const where = `($1 = '' OR u.email ILIKE $2 ESCAPE '\\' OR u.display_name ILIKE $2 ESCAPE '\\')
       AND ($3 = 'all' OR ($3 = 'verified' AND u.email_verified) OR ($3 = 'pending' AND NOT u.email_verified))
       AND ($4 = 'all' OR ($4 = 'has' AND coalesce(l.login_count, 0) > 0) OR ($4 = 'none' AND coalesce(l.login_count, 0) = 0))
       AND ($5 = 'all' OR ($5 = 'has' AND coalesce(s.session_count, 0) > 0) OR ($5 = 'none' AND coalesce(s.session_count, 0) = 0))
       AND ($6 = 'all' OR ($6 = 'has' AND coalesce(p.app_seconds, 0) > 0) OR ($6 = 'none' AND coalesce(p.app_seconds, 0) = 0))
       AND ($7::date IS NULL OR u.created_at >= $7::date)
       AND ($8::date IS NULL OR u.created_at < $8::date + interval '1 day')`;
  try {
    const result = await query(
      `SELECT u.id, u.email, u.display_name, u.email_verified, u.created_at,
              (u.password_hash IS NOT NULL) AS has_password,
              EXISTS (SELECT 1 FROM oauth_accounts o WHERE o.user_id = u.id AND o.provider = 'google') AS has_google,
              coalesce(s.session_count, 0)::int AS session_count,
              coalesce(s.study_seconds, 0)::bigint AS study_seconds,
              s.last_studied_at,
              coalesce(l.login_count, 0)::int AS login_count,
              l.last_login_at,
              coalesce(p.app_seconds, 0)::bigint AS app_seconds,
              p.last_page_at
       FROM users u
       LEFT JOIN (
         SELECT user_id, count(*)::int AS session_count,
                sum(extract(epoch FROM (ended_at - started_at)))::bigint AS study_seconds,
                max(ended_at) AS last_studied_at
         FROM time_entries GROUP BY user_id
       ) s ON s.user_id = u.id
       LEFT JOIN (
         SELECT user_id, count(*)::int AS login_count, max(created_at) AS last_login_at
         FROM login_sessions GROUP BY user_id
       ) l ON l.user_id = u.id
       LEFT JOIN (
         SELECT user_id, sum(duration_seconds)::bigint AS app_seconds, max(last_seen_at) AS last_page_at
         FROM user_page_activity GROUP BY user_id
       ) p ON p.user_id = u.id
       WHERE ${where}
       ORDER BY ${sortColumn} ${sortDirection} NULLS LAST, lower(u.email) ASC
       LIMIT $9 OFFSET $10`,
      [...filterParams, limit, offset]
    );
    const total = await query(
      `SELECT count(*)::int AS total FROM users u
       LEFT JOIN (SELECT user_id, count(*)::int AS login_count FROM login_sessions GROUP BY user_id) l ON l.user_id = u.id
       LEFT JOIN (SELECT user_id, count(*)::int AS session_count FROM time_entries GROUP BY user_id) s ON s.user_id = u.id
       LEFT JOIN (SELECT user_id, sum(duration_seconds)::bigint AS app_seconds FROM user_page_activity GROUP BY user_id) p ON p.user_id = u.id
       WHERE ${where}`,
      filterParams
    );
    return res.json({ users: result.rows, total: total.rows[0].total, limit, offset });
  } catch (error) {
    console.error('[Admin users list error]:', error);
    return res.status(500).json({ error: 'Could not load user records.' });
  }
});

adminRouter.get('/users/:userId/page-activity', async (req, res) => {
  if (!uuidPattern.test(req.params.userId)) return res.status(400).json({ error: 'Invalid account.' });
  try {
    const result = await query(
      `SELECT page, sum(duration_seconds)::bigint AS duration_seconds,
              max(last_seen_at) AS last_seen_at, count(*)::int AS active_days
       FROM user_page_activity WHERE user_id = $1
       GROUP BY page ORDER BY sum(duration_seconds) DESC, page ASC`,
      [req.params.userId]
    );
    return res.json({ pages: result.rows });
  } catch (error) {
    console.error('[Admin page activity error]:', error);
    return res.status(500).json({ error: 'Could not load page activity.' });
  }
});

adminRouter.get('/users/:userId/login-sessions', async (req, res) => {
  if (!uuidPattern.test(req.params.userId)) return res.status(400).json({ error: 'Invalid account.' });
  try {
    const result = await query(
      `SELECT id, auth_method, ip_address::text AS ip_address, user_agent, created_at, expires_at, ended_at,
              CASE WHEN ended_at IS NOT NULL THEN 'ended'
                   WHEN expires_at <= now() THEN 'expired'
                   ELSE 'active' END AS status
       FROM login_sessions WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 100`,
      [req.params.userId]
    );
    return res.json({ sessions: result.rows });
  } catch (error) {
    console.error('[Admin login sessions error]:', error);
    return res.status(500).json({ error: 'Could not load login history.' });
  }
});

adminRouter.patch('/settings/signups', async (req, res) => {
  if (typeof req.body?.enabled !== 'boolean') {
    return res.status(400).json({ error: 'Choose whether signups should be enabled.' });
  }
  try {
    const result = await query(
      `INSERT INTO app_admin_settings (id, signups_enabled, updated_at, updated_by)
       VALUES (1, $1, now(), $2)
       ON CONFLICT (id) DO UPDATE
       SET signups_enabled = EXCLUDED.signups_enabled,
           updated_at = now(), updated_by = EXCLUDED.updated_by
       RETURNING signups_enabled, updated_at`,
      [req.body.enabled, req.userId]
    );
    return res.json({ settings: result.rows[0] });
  } catch (error) {
    console.error('[Admin signup setting error]:', error);
    return res.status(500).json({ error: 'Could not update signup settings.' });
  }
});

async function sendAccountSetupEmail(user) {
  if (process.env.NODE_ENV === 'production' && !(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
      && !(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)) {
    throw Object.assign(new Error('Email service is not configured on this server.'), { status: 503 });
  }

  const maxPerHour = 3;
  const existing = await query(
    'SELECT sent_at, send_window_started_at, send_count FROM password_reset_challenges WHERE email = $1',
    [user.email]
  );
  if (existing.rows[0]) {
    const challenge = existing.rows[0];
    const inCooldown = Date.now() - new Date(challenge.sent_at).getTime() < 60_000;
    const windowActive = Date.now() - new Date(challenge.send_window_started_at).getTime() < 60 * 60 * 1000;
    if (inCooldown || (windowActive && challenge.send_count >= maxPerHour)) {
      throw Object.assign(new Error('A password setup email was sent recently. Please wait before sending another.'), { status: 429 });
    }
  }

  const code = newVerificationCode();
  const codeHash = hashVerificationCode(user.email, code);
  const challenge = await query(
    `INSERT INTO password_reset_challenges
       (email, code_hash, expires_at, sent_at, send_window_started_at, send_count, attempts, created_at)
     VALUES ($1, $2, now() + interval '10 minutes', now(), now(), 1, 0, now())
     ON CONFLICT (email) DO UPDATE SET
       code_hash = EXCLUDED.code_hash,
       expires_at = EXCLUDED.expires_at,
       sent_at = now(),
       send_window_started_at = CASE
         WHEN password_reset_challenges.send_window_started_at <= now() - interval '1 hour' THEN now()
         ELSE password_reset_challenges.send_window_started_at END,
       send_count = CASE
         WHEN password_reset_challenges.send_window_started_at <= now() - interval '1 hour' THEN 1
         ELSE password_reset_challenges.send_count + 1 END,
       attempts = 0,
       created_at = now()
     WHERE password_reset_challenges.sent_at <= now() - interval '60 seconds'
       AND (password_reset_challenges.send_window_started_at <= now() - interval '1 hour'
         OR password_reset_challenges.send_count < $3)
     RETURNING email`,
    [user.email, codeHash, maxPerHour]
  );
  if (!challenge.rows[0]) {
    throw Object.assign(new Error('A password setup email was sent recently. Please wait before sending another.'), { status: 429 });
  }
  try {
    await sendPasswordResetEmail(user.email, user.display_name, code);
  } catch (error) {
    await query('DELETE FROM password_reset_challenges WHERE email = $1 AND code_hash = $2', [user.email, codeHash]);
    throw error;
  }
}

adminRouter.post('/users', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const displayName = typeof req.body?.displayName === 'string' ? req.body.displayName.trim() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (!displayName || displayName.length > 80) return res.status(400).json({ error: 'Name must be between 1 and 80 characters.' });
  if (isAdminEmail(email)) return res.status(400).json({ error: 'Admin accounts must sign up or sign in through the normal authentication flow.' });
  try {
    const created = await query(
      `INSERT INTO users (email, display_name, password_hash, email_verified)
       VALUES ($1, $2, NULL, false)
       RETURNING id, email, display_name, email_verified, created_at`,
      [email, displayName]
    );
    const user = created.rows[0];
    let setupEmailSent = false;
    let setupEmailError = null;
    try {
      await sendAccountSetupEmail(user);
      setupEmailSent = true;
    } catch (error) {
      setupEmailError = error.message || 'Account was created, but the setup email could not be sent.';
    }
    return res.status(201).json({ user, setupEmailSent, setupEmailError });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'An account with this email already exists.' });
    console.error('[Admin create user error]:', error);
    return res.status(500).json({ error: 'Could not create the account.' });
  }
});

adminRouter.post('/users/:userId/send-password-reset', async (req, res) => {
  try {
    const result = await query(
      'SELECT id, email, display_name FROM users WHERE id = $1',
      [req.params.userId]
    );
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found.' });
    await sendAccountSetupEmail(user);
    return res.json({ sent: true, message: `Password setup email sent to ${user.email}.` });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    console.error('[Admin password reset error]:', error);
    return res.status(500).json({ error: 'Could not send the password reset email.' });
  }
});

adminRouter.delete('/users/:userId', async (req, res) => {
  const confirmEmail = typeof req.body?.confirmEmail === 'string' ? req.body.confirmEmail.trim().toLowerCase() : '';
  try {
    const found = await query('SELECT id, email FROM users WHERE id = $1', [req.params.userId]);
    const user = found.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found.' });
    if (user.id === req.userId) return res.status(400).json({ error: 'You cannot delete your own administrator account here.' });
    if (isAdminEmail(user.email)) return res.status(400).json({ error: 'Administrator accounts cannot be deleted from this panel.' });
    if (confirmEmail !== user.email.toLowerCase()) {
      return res.status(400).json({ error: 'Enter the user email exactly to confirm deletion.' });
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM email_verification_challenges WHERE email = $1', [user.email]);
      await client.query('DELETE FROM password_reset_challenges WHERE email = $1', [user.email]);
      await client.query('DELETE FROM time_entries WHERE user_id = $1', [user.id]);
      await client.query('DELETE FROM active_timers WHERE user_id = $1', [user.id]);

      // Subproject parent links are RESTRICTed, so remove leaf nodes first.
      while (true) {
        const leaves = await client.query(
          `SELECT sp.id FROM subprojects sp
           JOIN projects p ON p.id = sp.project_id
           WHERE p.user_id = $1
             AND NOT EXISTS (
               SELECT 1 FROM subprojects child WHERE child.parent_subproject_id = sp.id
             )`,
          [user.id]
        );
        if (!leaves.rows.length) break;
        await client.query('DELETE FROM subprojects WHERE id = ANY($1::uuid[])', [leaves.rows.map((row) => row.id)]);
      }
      const remainingSubprojects = await client.query(
        `SELECT 1 FROM subprojects sp JOIN projects p ON p.id = sp.project_id
         WHERE p.user_id = $1 LIMIT 1`,
        [user.id]
      );
      if (remainingSubprojects.rows.length) throw new Error('Project hierarchy contains a cycle and cannot be deleted safely.');
      await client.query('DELETE FROM users WHERE id = $1', [user.id]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    return res.json({ deleted: true });
  } catch (error) {
    console.error('[Admin delete user error]:', error);
    return res.status(500).json({ error: 'Could not delete the user account.' });
  }
});
