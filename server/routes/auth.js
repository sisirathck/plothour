import { Router } from 'express';
import { query } from '../db.js';
import {
  hashPassword,
  verifyPassword,
  createSessionToken,
  verifySessionToken,
  setSessionCookie,
  clearSessionCookie,
  verifyGoogleIdToken,
} from '../auth.js';

export const authRouter = Router();

/**
 * Health & Configuration status endpoint
 * Used by frontend to detect if DB & AUTH_SECRET are configured.
 */
authRouter.get('/status', async (req, res) => {
  try {
    const dbRes = await query('SELECT 1 as connected');
    const dbReady = dbRes.rows.length > 0;
    const authSecretReady = Boolean(process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 16);
    const googleReady = Boolean(process.env.GOOGLE_CLIENT_ID);

    res.json({
      configured: dbReady && authSecretReady,
      database: dbReady,
      authSecret: authSecretReady,
      googleAuth: googleReady,
      googleClientId: process.env.GOOGLE_CLIENT_ID || null,
    });
  } catch (err) {
    res.json({
      configured: false,
      database: false,
      authSecret: Boolean(process.env.AUTH_SECRET),
      googleAuth: Boolean(process.env.GOOGLE_CLIENT_ID),
      error: err.message,
    });
  }
});

/**
 * Register with email and password
 */
authRouter.post('/register', async (req, res) => {
  try {
    const { email, password, displayName } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    }

    const name = displayName?.trim() || email.split('@')[0];
    const passwordHash = await hashPassword(password);

    const result = await query(
      `INSERT INTO users (email, display_name, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, email, display_name, timezone, week_starts_on, created_at`,
      [email.trim().toLowerCase(), name, passwordHash]
    );

    const user = result.rows[0];
    const token = createSessionToken(user);
    setSessionCookie(res, token);

    return res.status(201).json({ user, token });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'An account with this email address already exists.' });
    }
    console.error('[Auth Register Error]:', err);
    return res.status(500).json({ error: 'An error occurred during account creation. Please try again.' });
  }
});

/**
 * Log in with email and password
 */
authRouter.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Please provide both email and password.' });
    }

    const result = await query(
      `SELECT id, email, display_name, password_hash, timezone, week_starts_on
       FROM users
       WHERE lower(email) = lower($1)`,
      [email.trim()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = result.rows[0];

    if (!user.password_hash) {
      return res.status(400).json({
        error: 'This account was created with Google sign-in. Please log in using Google.',
      });
    }

    const isValid = await verifyPassword(user.password_hash, password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = createSessionToken(user);
    setSessionCookie(res, token);

    const safeUser = {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      timezone: user.timezone,
      week_starts_on: user.week_starts_on,
    };

    return res.json({ user: safeUser, token });
  } catch (err) {
    console.error('[Auth Login Error]:', err);
    return res.status(500).json({ error: 'Login failed due to a server error. Please try again.' });
  }
});

/**
 * Google Sign-In verification endpoint
 */
authRouter.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ error: 'Missing Google credential token.' });
    }

    const googleUser = await verifyGoogleIdToken(credential);

    // 1. Check if OAuth account is already linked
    const existingOauth = await query(
      `SELECT user_id FROM oauth_accounts WHERE provider = 'google' AND provider_subject = $1`,
      [googleUser.sub]
    );

    let user;

    if (existingOauth.rows.length > 0) {
      const userRes = await query(
        `SELECT id, email, display_name, timezone, week_starts_on FROM users WHERE id = $1`,
        [existingOauth.rows[0].user_id]
      );
      user = userRes.rows[0];
    } else {
      // 2. Check if a user with this email already exists
      const existingUser = await query(
        `SELECT id, email, display_name, timezone, week_starts_on FROM users WHERE lower(email) = lower($1)`,
        [googleUser.email]
      );

      if (existingUser.rows.length > 0) {
        user = existingUser.rows[0];
        // Link OAuth account to existing user
        await query(
          `INSERT INTO oauth_accounts (user_id, provider, provider_subject, email_at_provider)
           VALUES ($1, 'google', $2, $3)
           ON CONFLICT DO NOTHING`,
          [user.id, googleUser.sub, googleUser.email]
        );
      } else {
        // 3. Create brand new user & link Google account
        const newUserRes = await query(
          `INSERT INTO users (email, display_name, password_hash)
           VALUES ($1, $2, NULL)
           RETURNING id, email, display_name, timezone, week_starts_on`,
          [googleUser.email.toLowerCase(), googleUser.displayName]
        );
        user = newUserRes.rows[0];

        await query(
          `INSERT INTO oauth_accounts (user_id, provider, provider_subject, email_at_provider)
           VALUES ($1, 'google', $2, $3)`,
          [user.id, googleUser.sub, googleUser.email]
        );
      }
    }

    const token = createSessionToken(user);
    setSessionCookie(res, token);

    return res.json({ user });
  } catch (err) {
    console.error('[Google Auth Error]:', err);
    return res.status(400).json({ error: err.message || 'Google authentication failed.' });
  }
});

/**
 * Get currently authenticated user session
 */
authRouter.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const token = req.cookies?.studyduel_session || bearerToken;
    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const payload = verifySessionToken(token);
    if (!payload || !payload.userId) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    const result = await query(
      `SELECT id, email, display_name, timezone, week_starts_on, created_at
       FROM users
       WHERE id = $1`,
      [payload.userId]
    );

    if (result.rows.length === 0) {
      clearSessionCookie(res);
      return res.status(401).json({ error: 'User account not found' });
    }

    return res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('[Auth /me Error]:', err);
    return res.status(500).json({ error: 'Could not verify session' });
  }
});

/** Save profile-level settings for the authenticated account. */
authRouter.patch('/profile', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const token = req.cookies?.studyduel_session || bearerToken;
    const payload = token ? verifySessionToken(token) : null;
    if (!payload?.userId) return res.status(401).json({ error: 'Not authenticated' });

    const displayName = typeof req.body?.displayName === 'string' ? req.body.displayName.trim() : '';
    const timezone = typeof req.body?.timezone === 'string' ? req.body.timezone : '';
    const weekStartsOn = Number(req.body?.weekStartsOn);
    if (!displayName || displayName.length > 80) {
      return res.status(400).json({ error: 'Display name must be between 1 and 80 characters.' });
    }
    if (!Number.isInteger(weekStartsOn) || weekStartsOn < 0 || weekStartsOn > 6) {
      return res.status(400).json({ error: 'Choose a valid start day for the week.' });
    }
    try {
      new Intl.DateTimeFormat('en', { timeZone: timezone });
    } catch {
      return res.status(400).json({ error: 'Choose a valid time zone.' });
    }

    const result = await query(
      `UPDATE users
       SET display_name = $2, timezone = $3, week_starts_on = $4, updated_at = now()
       WHERE id = $1
       RETURNING id, email, display_name, timezone, week_starts_on`,
      [payload.userId, displayName, timezone, weekStartsOn]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User account not found.' });
    return res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('[Auth Profile Update Error]:', err);
    return res.status(500).json({ error: 'Could not save profile settings.' });
  }
});

/**
 * Log out and clear session cookie
 */
authRouter.post('/logout', (req, res) => {
  clearSessionCookie(res);
  return res.json({ success: true });
});
