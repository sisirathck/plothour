import { Router } from 'express';
import { authenticate } from '../middleware.js';
import { loginRateLimit } from '../requestSecurity.js';
import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import nodemailer from 'nodemailer';
import { query } from '../db.js';
import { getBrandedEmailFrom } from '../emailDelivery.js';
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

const verificationCodeLifetimeMinutes = 10;
const verificationResendDelaySeconds = 60;
const maximumVerificationEmailsPerHour = 3;
const maximumVerificationAttempts = 5;

export function hashVerificationCode(email, code) {
  const secret = process.env.AUTH_SECRET || 'studyduel-development-fallback-secret-key-32b';
  return createHmac('sha256', secret).update(`${email}:${code}`).digest('hex');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function getSmtpTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
}

function isEmailConfigured() {
  const hasSmtp = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
  const hasResend = Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
  return hasSmtp || hasResend;
}

async function sendVerificationEmail(email, displayName, code) {
  const from = getBrandedEmailFrom();
  const safeName = escapeHtml(displayName || 'there');
  const subject = 'Your PlotHour verification code';
  const text = `Hi ${displayName || 'there'},\n\nYour PlotHour verification code is ${code}. It expires in ${verificationCodeLifetimeMinutes} minutes. If you did not request an account, you can ignore this email.`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;color:#20243a"><h1 style="font-size:22px">Verify your email</h1><p>Hi ${safeName}, enter this code in PlotHour to finish creating your account:</p><p style="font-size:32px;font-weight:700;letter-spacing:8px;padding:16px 20px;background:#f3f2ff;border-radius:12px;display:inline-block">${code}</p><p>This code expires in ${verificationCodeLifetimeMinutes} minutes. If you did not request an account, you can ignore this email.</p></div>`;

  // 1. Send via SMTP if configured
  const smtpTransporter = getSmtpTransporter();
  if (smtpTransporter) {
    await smtpTransporter.sendMail({
      from,
      to: email,
      subject,
      text,
      html,
    });
    return;
  }

  // 2. Send via Resend API if configured
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey && process.env.EMAIL_FROM) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({ from, to: [email], subject, text, html }),
    });
    if (!response.ok) {
      console.error('[Email Verification] Resend request failed with status:', response.status);
      throw new Error('We could not send the verification email. Please try again shortly.');
    }
    return;
  }

  // 3. Fallback for local testing
  if (process.env.NODE_ENV !== 'production') {
    console.log('\n================================================================');
    console.log(` 🔑 [LOCAL DEV] EMAIL VERIFICATION CODE FOR: ${email}`);
    console.log(` >>> CODE: ${code} <<<`);
    console.log(' (Email credentials not configured; verification code printed here for local testing)');
    console.log('================================================================\n');
    return;
  }

  throw new Error('Email verification is not configured on this server.');
}

export async function sendPasswordResetEmail(email, displayName, code) {
  const from = getBrandedEmailFrom();
  const safeName = escapeHtml(displayName || 'there');
  const subject = 'Your PlotHour password reset code';
  const text = `Hi ${displayName || 'there'},\n\nYour password reset code is ${code}. It expires in ${verificationCodeLifetimeMinutes} minutes.\n\nIf you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;color:#20243a"><h1 style="font-size:22px">Reset your password</h1><p>Hi ${safeName},</p><p>Enter this 6-digit code in PlotHour to reset your account password:</p><p style="font-size:32px;font-weight:700;letter-spacing:8px;padding:16px 20px;background:#fff1f0;color:#e11d48;border-radius:12px;display:inline-block">${code}</p><p>This code expires in ${verificationCodeLifetimeMinutes} minutes.</p><p style="color:#64748b;font-size:13px">If you did not request a password reset, you can safely ignore this email. Your account password will remain unchanged.</p></div>`;

  // 1. Send via SMTP if configured
  const smtpTransporter = getSmtpTransporter();
  if (smtpTransporter) {
    await smtpTransporter.sendMail({
      from,
      to: email,
      subject,
      text,
      html,
    });
    return;
  }

  // 2. Send via Resend API if configured
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey && process.env.EMAIL_FROM) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({ from, to: [email], subject, text, html }),
    });
    if (!response.ok) {
      console.error('[Password Reset] Resend request failed with status:', response.status);
      throw new Error('We could not send the password reset email. Please try again shortly.');
    }
    return;
  }

  // 3. Fallback for local testing
  if (process.env.NODE_ENV !== 'production') {
    console.log('\n================================================================');
    console.log(` 🔑 [LOCAL DEV] PASSWORD RESET CODE FOR: ${email}`);
    console.log(` >>> CODE: ${code} <<<`);
    console.log(' (Email credentials not configured; reset code printed here for local testing)');
    console.log('================================================================\n');
    return;
  }

  throw new Error('Email verification is not configured on this server.');
}

export function newVerificationCode() {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

async function createTrackedLogin(req, res, user, authMethod) {
  const token = createSessionToken(user);
  const payload = verifySessionToken(token);
  await query(
    `INSERT INTO login_sessions (id, user_id, auth_method, ip_address, user_agent, expires_at)
     VALUES ($1, $2, $3, $4::inet, $5, to_timestamp($6))`,
    [payload.jti, user.id, authMethod, req.ip || null, String(req.get('user-agent') || '').slice(0, 1000) || null, payload.exp]
  );
  setSessionCookie(res, token);
  return token;
}

/**
 * Health & Configuration status endpoint
 * Used by frontend to detect if DB & AUTH_SECRET are configured.
 */
authRouter.get('/status', async (req, res) => {
  try {
    const dbRes = await query('SELECT 1 as connected');
    const dbReady = dbRes.rows.length > 0;
    const authSecretReady = Boolean(process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 32);
    const googleReady = Boolean(process.env.GOOGLE_CLIENT_ID);
    const emailConfigured = isEmailConfigured();
    const isDev = process.env.NODE_ENV !== 'production';
    const emailVerificationReady = emailConfigured || isDev;

    res.json({
      configured: dbReady && authSecretReady,
      database: dbReady,
      authSecret: authSecretReady,
      googleAuth: googleReady,
      emailVerification: emailVerificationReady,
      emailVerificationDevMode: !emailConfigured && isDev,
      googleClientId: process.env.GOOGLE_CLIENT_ID || null,
    });
  } catch (err) {
    const emailConfigured = isEmailConfigured();
    const isDev = process.env.NODE_ENV !== 'production';
    res.json({
      configured: false,
      database: false,
      authSecret: Boolean(process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 32),
      googleAuth: Boolean(process.env.GOOGLE_CLIENT_ID),
      emailVerification: emailConfigured || isDev,
      emailVerificationDevMode: !emailConfigured && isDev,
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
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const name = typeof displayName === 'string' ? displayName.trim() : '';

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    if (typeof password !== 'string' || password.length < 8 || password.length > 200) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    }
    if (name.length > 80) return res.status(400).json({ error: 'Name must be 80 characters or fewer.' });
    const signupSetting = await query('SELECT signups_enabled FROM app_admin_settings WHERE id = 1');
    if (signupSetting.rows[0]?.signups_enabled === false) {
      return res.status(403).json({ error: 'New account signups are temporarily paused. Please try again later.' });
    }
    if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) {
      return res.status(503).json({ error: 'Secure account authentication is not configured on this server yet.' });
    }
    if (!isEmailConfigured()) {
      if (process.env.NODE_ENV === 'production') {
        return res.status(503).json({ error: 'Email verification is not configured on this server yet.' });
      }
    }

    const existingUser = await query('SELECT 1 FROM users WHERE lower(email) = $1', [normalizedEmail]);
    if (existingUser.rows.length) {
      return res.status(409).json({ error: 'An account with this email address already exists. Please log in.' });
    }

    const currentChallenge = await query(
      'SELECT sent_at, send_window_started_at, send_count FROM email_verification_challenges WHERE email = $1',
      [normalizedEmail]
    );
    if (currentChallenge.rows[0]) {
      const challenge = currentChallenge.rows[0];
      const sentRecently = Date.now() - new Date(challenge.sent_at).getTime() < verificationResendDelaySeconds * 1000;
      const windowExpired = Date.now() - new Date(challenge.send_window_started_at).getTime() >= 60 * 60 * 1000;
      if (sentRecently) return res.status(429).json({ error: 'A verification code was sent recently. Please wait a minute before requesting another.' });
      if (!windowExpired && challenge.send_count >= maximumVerificationEmailsPerHour) {
        return res.status(429).json({ error: 'Too many verification emails were requested. Try again in an hour.' });
      }
    }

    const passwordHash = await hashPassword(password);
    const code = newVerificationCode();
    const codeHash = hashVerificationCode(normalizedEmail, code);
    const finalName = name || normalizedEmail.split('@')[0];
    const result = await query(
      `INSERT INTO email_verification_challenges (email, display_name, password_hash, code_hash, expires_at, sent_at, send_window_started_at, send_count, attempts, created_at)
       VALUES ($1, $2, $3, $4, now() + ($5 * interval '1 minute'), now(), now(), 1, 0, now())
       ON CONFLICT (email) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         password_hash = EXCLUDED.password_hash,
         code_hash = EXCLUDED.code_hash,
         expires_at = EXCLUDED.expires_at,
         sent_at = EXCLUDED.sent_at,
         send_window_started_at = CASE
           WHEN email_verification_challenges.send_window_started_at <= now() - interval '1 hour' THEN now()
           ELSE email_verification_challenges.send_window_started_at END,
         send_count = CASE
           WHEN email_verification_challenges.send_window_started_at <= now() - interval '1 hour' THEN 1
           ELSE email_verification_challenges.send_count + 1 END,
         attempts = 0,
         created_at = now()
       WHERE email_verification_challenges.sent_at <= now() - ($6 * interval '1 second')
         AND (email_verification_challenges.send_window_started_at <= now() - interval '1 hour'
           OR email_verification_challenges.send_count < $7)
       RETURNING email`,
      [normalizedEmail, finalName, passwordHash, codeHash, verificationCodeLifetimeMinutes, verificationResendDelaySeconds, maximumVerificationEmailsPerHour]
    );
    if (!result.rows[0]) return res.status(429).json({ error: 'Too many verification emails were requested. Please wait before trying again.' });

    try {
      await sendVerificationEmail(normalizedEmail, finalName, code);
    } catch (error) {
      await query('DELETE FROM email_verification_challenges WHERE email = $1 AND code_hash = $2', [normalizedEmail, codeHash]);
      console.error('[Auth Register Email Error]:', error.message);
      return res.status(503).json({ error: error.message || 'Could not send the verification code.' });
    }

    return res.status(202).json({ verificationRequired: true, email: normalizedEmail });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'An account with this email address already exists.' });
    }
    console.error('[Auth Register Error]:', err);
    return res.status(500).json({ error: 'An error occurred during account creation. Please try again.' });
  }
});

/** Verify a pending password registration and create the account. */
authRouter.post('/verify-email', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: 'Enter the 6-digit verification code sent to your email.' });
  }
  try {
    const result = await query(
      `SELECT display_name, password_hash, code_hash, expires_at, attempts
       FROM email_verification_challenges WHERE email = $1`,
      [email]
    );
    const challenge = result.rows[0];
    if (!challenge || new Date(challenge.expires_at).getTime() <= Date.now()) {
      if (challenge) await query('DELETE FROM email_verification_challenges WHERE email = $1', [email]);
      return res.status(400).json({ error: 'That code has expired. Request a new verification code.' });
    }
    if (challenge.attempts >= maximumVerificationAttempts) {
      return res.status(429).json({ error: 'Too many incorrect attempts. Request a new verification code.' });
    }

    const submittedHash = Buffer.from(hashVerificationCode(email, code), 'hex');
    const expectedHash = Buffer.from(challenge.code_hash, 'hex');
    if (submittedHash.length !== expectedHash.length || !timingSafeEqual(submittedHash, expectedHash)) {
      const failed = await query(
        `UPDATE email_verification_challenges SET attempts = attempts + 1
         WHERE email = $1 AND attempts < $2 RETURNING attempts`,
        [email, maximumVerificationAttempts]
      );
      return res.status(failed.rows[0]?.attempts >= maximumVerificationAttempts ? 429 : 400).json({
        error: failed.rows[0]?.attempts >= maximumVerificationAttempts
          ? 'Too many incorrect attempts. Request a new verification code.'
          : 'That verification code is incorrect.',
      });
    }

    const consumed = await query(
      `DELETE FROM email_verification_challenges
       WHERE email = $1 AND code_hash = $2 AND expires_at > now() AND attempts < $3
       RETURNING display_name, password_hash`,
      [email, challenge.code_hash, maximumVerificationAttempts]
    );
    if (!consumed.rows[0]) return res.status(400).json({ error: 'That code has expired or was already used. Request a new code.' });

    const created = await query(
      `INSERT INTO users (email, display_name, password_hash, email_verified)
       VALUES ($1, $2, $3, true)
       RETURNING id, email, display_name, timezone, week_starts_on, created_at, is_admin`,
      [email, consumed.rows[0].display_name, consumed.rows[0].password_hash]
    );
    const user = created.rows[0];
    const token = await createTrackedLogin(req, res, user, 'password_signup');
    return res.status(201).json({ user: { ...user, is_admin: Boolean(user.is_admin) }, token });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'An account with this email address already exists. Please log in.' });
    console.error('[Auth Verify Email Error]:', err);
    return res.status(500).json({ error: 'Could not verify your email. Please try again.' });
  }
});

/** Resend the code for an existing pending registration. */
authRouter.post('/resend-verification', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (!isEmailConfigured()) {
    if (process.env.NODE_ENV === 'production') {
      return res.status(503).json({ error: 'Email verification is not configured on this server yet.' });
    }
  }
  try {
    const current = await query(
      'SELECT display_name, sent_at, send_window_started_at, send_count FROM email_verification_challenges WHERE email = $1',
      [email]
    );
    if (!current.rows[0]) return res.status(404).json({ error: 'No pending signup was found. Start creating your account again.' });
    if (Date.now() - new Date(current.rows[0].sent_at).getTime() < verificationResendDelaySeconds * 1000) {
      return res.status(429).json({ error: 'Please wait a minute before requesting another code.' });
    }
    const windowExpired = Date.now() - new Date(current.rows[0].send_window_started_at).getTime() >= 60 * 60 * 1000;
    if (!windowExpired && current.rows[0].send_count >= maximumVerificationEmailsPerHour) {
      return res.status(429).json({ error: 'Too many verification emails were requested. Try again in an hour.' });
    }

    const code = newVerificationCode();
    const codeHash = hashVerificationCode(email, code);
    const updated = await query(
      `UPDATE email_verification_challenges
       SET code_hash = $2, expires_at = now() + ($3 * interval '1 minute'), sent_at = now(), attempts = 0, created_at = now(),
           send_window_started_at = CASE WHEN send_window_started_at <= now() - interval '1 hour' THEN now() ELSE send_window_started_at END,
           send_count = CASE WHEN send_window_started_at <= now() - interval '1 hour' THEN 1 ELSE send_count + 1 END
       WHERE email = $1 AND sent_at <= now() - ($4 * interval '1 second')
         AND (send_window_started_at <= now() - interval '1 hour' OR send_count < $5)
       RETURNING display_name`,
      [email, codeHash, verificationCodeLifetimeMinutes, verificationResendDelaySeconds, maximumVerificationEmailsPerHour]
    );
    if (!updated.rows[0]) return res.status(429).json({ error: 'Too many verification emails were requested. Please wait before trying again.' });
    try {
      await sendVerificationEmail(email, updated.rows[0].display_name, code);
    } catch (error) {
      await query('DELETE FROM email_verification_challenges WHERE email = $1 AND code_hash = $2', [email, codeHash]);
      console.error('[Auth Resend Email Error]:', error.message);
      return res.status(503).json({ error: error.message || 'Could not send the verification code.' });
    }
    return res.json({ sent: true });
  } catch (err) {
    console.error('[Auth Resend Verification Error]:', err);
    return res.status(500).json({ error: 'Could not resend the verification code.' });
  }
});

/**
 * Log in with email and password
 */
authRouter.post('/login', loginRateLimit, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Please provide both email and password.' });
    }

    const result = await query(
      `SELECT id, email, display_name, password_hash, timezone, week_starts_on, email_verified, is_admin
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
    if (!user.email_verified) {
      return res.status(403).json({ error: 'Verify your email before signing in.' });
    }

    const token = await createTrackedLogin(req, res, user, 'password');

    const safeUser = {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      timezone: user.timezone,
      week_starts_on: user.week_starts_on,
      has_password: Boolean(user.password_hash),
      is_admin: Boolean(user.email_verified && user.is_admin),
    };

    return res.json({ user: safeUser, token });
  } catch (err) {
    console.error('[Auth Login Error]:', err);
    return res.status(500).json({ error: 'Login failed due to a server error. Please try again.' });
  }
});

/**
 * Request a 6-digit password reset code sent to the user's email.
 */
authRouter.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    if (!isEmailConfigured() && process.env.NODE_ENV === 'production') {
      return res.status(503).json({ error: 'Email service is not configured on this server yet.' });
    }

    const userResult = await query(
      'SELECT id, email, display_name FROM users WHERE lower(email) = $1',
      [normalizedEmail]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'No user with this email found.' });
    }

    const user = userResult.rows[0];

    const currentChallenge = await query(
      'SELECT sent_at, send_window_started_at, send_count FROM password_reset_challenges WHERE email = $1',
      [normalizedEmail]
    );

    if (currentChallenge.rows[0]) {
      const challenge = currentChallenge.rows[0];
      const sentRecently = Date.now() - new Date(challenge.sent_at).getTime() < verificationResendDelaySeconds * 1000;
      const windowExpired = Date.now() - new Date(challenge.send_window_started_at).getTime() >= 60 * 60 * 1000;
      if (sentRecently) {
        return res.status(429).json({ error: 'A reset code was sent recently. Please wait a minute before requesting another.' });
      }
      if (!windowExpired && challenge.send_count >= maximumVerificationEmailsPerHour) {
        return res.status(429).json({ error: 'Too many password reset requests. Try again in an hour.' });
      }
    }

    const code = newVerificationCode();
    const codeHash = hashVerificationCode(normalizedEmail, code);

    const result = await query(
      `INSERT INTO password_reset_challenges (email, code_hash, expires_at, sent_at, send_window_started_at, send_count, attempts, created_at)
       VALUES ($1, $2, now() + ($3 * interval '1 minute'), now(), now(), 1, 0, now())
       ON CONFLICT (email) DO UPDATE SET
         code_hash = EXCLUDED.code_hash,
         expires_at = EXCLUDED.expires_at,
         sent_at = EXCLUDED.sent_at,
         send_window_started_at = CASE
           WHEN password_reset_challenges.send_window_started_at <= now() - interval '1 hour' THEN now()
           ELSE password_reset_challenges.send_window_started_at END,
         send_count = CASE
           WHEN password_reset_challenges.send_window_started_at <= now() - interval '1 hour' THEN 1
           ELSE password_reset_challenges.send_count + 1 END,
         attempts = 0,
         created_at = now()
       WHERE password_reset_challenges.sent_at <= now() - ($4 * interval '1 second')
         AND (password_reset_challenges.send_window_started_at <= now() - interval '1 hour'
           OR password_reset_challenges.send_count < $5)
       RETURNING email`,
      [normalizedEmail, codeHash, verificationCodeLifetimeMinutes, verificationResendDelaySeconds, maximumVerificationEmailsPerHour]
    );

    if (!result.rows[0]) {
      return res.status(429).json({ error: 'Too many reset requests. Please wait before trying again.' });
    }

    try {
      await sendPasswordResetEmail(normalizedEmail, user.display_name, code);
    } catch (error) {
      await query('DELETE FROM password_reset_challenges WHERE email = $1 AND code_hash = $2', [normalizedEmail, codeHash]);
      console.error('[Forgot Password Email Error]:', error.message);
      return res.status(503).json({ error: error.message || 'Could not send the password reset code.' });
    }

    return res.status(200).json({ success: true, email: normalizedEmail, message: 'Reset code sent to your email.' });
  } catch (err) {
    console.error('[Forgot Password Error]:', err);
    return res.status(500).json({ error: 'An error occurred while requesting password reset. Please try again.' });
  }
});

/**
 * Resend the 6-digit code for an active password reset request.
 */
authRouter.post('/resend-reset-code', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }
  if (!isEmailConfigured() && process.env.NODE_ENV === 'production') {
    return res.status(503).json({ error: 'Email service is not configured on this server yet.' });
  }

  try {
    const userResult = await query('SELECT display_name FROM users WHERE lower(email) = $1', [email]);
    if (!userResult.rows[0]) {
      return res.status(404).json({ error: 'No user with this email found.' });
    }

    const current = await query(
      'SELECT sent_at, send_window_started_at, send_count FROM password_reset_challenges WHERE email = $1',
      [email]
    );
    if (!current.rows[0]) {
      return res.status(404).json({ error: 'No active password reset request found. Request a new reset code.' });
    }
    if (Date.now() - new Date(current.rows[0].sent_at).getTime() < verificationResendDelaySeconds * 1000) {
      return res.status(429).json({ error: 'Please wait a minute before requesting another code.' });
    }
    const windowExpired = Date.now() - new Date(current.rows[0].send_window_started_at).getTime() >= 60 * 60 * 1000;
    if (!windowExpired && current.rows[0].send_count >= maximumVerificationEmailsPerHour) {
      return res.status(429).json({ error: 'Too many verification emails were requested. Try again in an hour.' });
    }

    const code = newVerificationCode();
    const codeHash = hashVerificationCode(email, code);
    const updated = await query(
      `UPDATE password_reset_challenges
       SET code_hash = $2, expires_at = now() + ($3 * interval '1 minute'), sent_at = now(), attempts = 0, created_at = now(),
           send_window_started_at = CASE WHEN send_window_started_at <= now() - interval '1 hour' THEN now() ELSE send_window_started_at END,
           send_count = CASE WHEN send_window_started_at <= now() - interval '1 hour' THEN 1 ELSE send_count + 1 END
       WHERE email = $1 AND sent_at <= now() - ($4 * interval '1 second')
         AND (send_window_started_at <= now() - interval '1 hour' OR send_count < $5)
       RETURNING email`,
      [email, codeHash, verificationCodeLifetimeMinutes, verificationResendDelaySeconds, maximumVerificationEmailsPerHour]
    );
    if (!updated.rows[0]) {
      return res.status(429).json({ error: 'Too many reset requests. Please wait before trying again.' });
    }

    try {
      await sendPasswordResetEmail(email, userResult.rows[0].display_name, code);
    } catch (error) {
      await query('DELETE FROM password_reset_challenges WHERE email = $1 AND code_hash = $2', [email, codeHash]);
      console.error('[Resend Reset Email Error]:', error.message);
      return res.status(503).json({ error: error.message || 'Could not send the reset code.' });
    }

    return res.json({ sent: true, message: 'A new reset code has been sent.' });
  } catch (err) {
    console.error('[Resend Reset Code Error]:', err);
    return res.status(500).json({ error: 'Could not resend the reset code.' });
  }
});

/**
 * Verify reset code and update password.
 */
authRouter.post('/reset-password', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }
  if (!/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: 'Enter the 6-digit verification code sent to your email.' });
  }
  if (newPassword.length < 8 || newPassword.length > 200) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
  }

  try {
    const result = await query(
      `SELECT code_hash, expires_at, attempts
       FROM password_reset_challenges WHERE email = $1`,
      [email]
    );
    const challenge = result.rows[0];
    if (!challenge || new Date(challenge.expires_at).getTime() <= Date.now()) {
      if (challenge) await query('DELETE FROM password_reset_challenges WHERE email = $1', [email]);
      return res.status(400).json({ error: 'That reset code has expired. Request a new code.' });
    }
    if (challenge.attempts >= maximumVerificationAttempts) {
      return res.status(429).json({ error: 'Too many incorrect attempts. Request a new reset code.' });
    }

    const submittedHash = Buffer.from(hashVerificationCode(email, code), 'hex');
    const expectedHash = Buffer.from(challenge.code_hash, 'hex');
    if (submittedHash.length !== expectedHash.length || !timingSafeEqual(submittedHash, expectedHash)) {
      const failed = await query(
        `UPDATE password_reset_challenges SET attempts = attempts + 1
         WHERE email = $1 AND attempts < $2 RETURNING attempts`,
        [email, maximumVerificationAttempts]
      );
      return res.status(failed.rows[0]?.attempts >= maximumVerificationAttempts ? 429 : 400).json({
        error: failed.rows[0]?.attempts >= maximumVerificationAttempts
          ? 'Too many incorrect attempts. Request a new reset code.'
          : 'That verification code is incorrect.',
      });
    }

    // Code is valid! Consume challenge
    await query('DELETE FROM password_reset_challenges WHERE email = $1', [email]);

    // Update user password and ensure email_verified is true
    const passwordHash = await hashPassword(newPassword);
    const updated = await query(
      `UPDATE users
       SET password_hash = $1, email_verified = true, updated_at = now()
       WHERE lower(email) = $2
       RETURNING id, email, display_name, timezone, week_starts_on, created_at, is_admin`,
      [passwordHash, email]
    );

    if (updated.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found.' });
    }

    const user = {
      ...updated.rows[0],
      has_password: true,
      is_admin: Boolean(updated.rows[0].is_admin),
    };
    const token = await createTrackedLogin(req, res, user, 'password_reset');

    return res.json({ success: true, user, token, message: 'Password reset successfully!' });
  } catch (err) {
    console.error('[Reset Password Error]:', err);
    return res.status(500).json({ error: 'Could not reset your password. Please try again.' });
  }
});

/**
 * Change password for authenticated users (e.g. from Settings).
 */
authRouter.post('/change-password', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const token = bearerToken || req.cookies?.studyduel_session;
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    const payload = verifySessionToken(token);
    if (!payload?.userId) return res.status(401).json({ error: 'Invalid or expired session' });

    const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

    if (!newPassword || newPassword.length < 8 || newPassword.length > 200) {
      return res.status(400).json({ error: 'New password must be at least 8 characters long.' });
    }

    const userRes = await query(
      'SELECT id, password_hash FROM users WHERE id = $1',
      [payload.userId]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const user = userRes.rows[0];

    // If account has an existing password, verify the current password
    if (user.password_hash) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Please enter your current password.' });
      }
      const isValid = await verifyPassword(user.password_hash, currentPassword);
      if (!isValid) {
        return res.status(400).json({ error: 'Current password is incorrect.' });
      }
      if (currentPassword === newPassword) {
        return res.status(400).json({ error: 'New password must be different from current password.' });
      }
    }

    const newHash = await hashPassword(newPassword);
    await query(
      'UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2',
      [newHash, payload.userId]
    );

    return res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err) {
    console.error('[Change Password Error]:', err);
    return res.status(500).json({ error: 'Could not change password. Please try again.' });
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
    if (!googleUser.emailVerified) {
      return res.status(403).json({ error: 'Your Google account must have a verified email address.' });
    }

    // 1. Check if OAuth account is already linked
    const existingOauth = await query(
      `SELECT user_id FROM oauth_accounts WHERE provider = 'google' AND provider_subject = $1`,
      [googleUser.sub]
    );

    let user;

    if (existingOauth.rows.length > 0) {
      const userRes = await query(
        `SELECT id, email, display_name, timezone, week_starts_on, email_verified, is_admin FROM users WHERE id = $1`,
        [existingOauth.rows[0].user_id]
      );
      user = userRes.rows[0];
    } else {
      // 2. Check if a user with this email already exists
      const existingUser = await query(
        `SELECT id, email, display_name, timezone, week_starts_on, email_verified, is_admin FROM users WHERE lower(email) = lower($1)`,
        [googleUser.email]
      );

      if (existingUser.rows.length > 0) {
        user = existingUser.rows[0];
        await query('UPDATE users SET email_verified = true WHERE id = $1', [user.id]);
        user.email_verified = true;
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
          `INSERT INTO users (email, display_name, password_hash, email_verified)
           VALUES ($1, $2, NULL, true)
           RETURNING id, email, display_name, timezone, week_starts_on, email_verified, is_admin`,
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

    await createTrackedLogin(req, res, user, 'google');

    return res.json({ user: { ...user, is_admin: Boolean(user.email_verified && user.is_admin) } });
  } catch (err) {
    console.error('[Google Auth Error]:', err);
    return res.status(400).json({ error: err.message || 'Google authentication failed.' });
  }
});

/**
 * Get currently authenticated user session
 */
authRouter.get('/me', authenticate, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const token = bearerToken || req.cookies?.studyduel_session;
    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const payload = verifySessionToken(token);
    if (!payload || !payload.userId) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    const result = await query(
      `SELECT id, email, display_name, timezone, week_starts_on, created_at, email_verified, is_admin,
              (password_hash IS NOT NULL) AS has_password
       FROM users
       WHERE id = $1`,
      [payload.userId]
    );

    if (result.rows.length === 0) {
      clearSessionCookie(res);
      return res.status(401).json({ error: 'User account not found' });
    }

    const row = result.rows[0];
    return res.json({
      user: {
        ...row,
        has_password: Boolean(row.has_password),
        is_admin: Boolean(row.email_verified && row.is_admin),
      },
    });
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
    const token = bearerToken || req.cookies?.studyduel_session;
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
       RETURNING id, email, display_name, timezone, week_starts_on, is_admin`,
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
authRouter.post('/logout', async (req, res) => {
  const token = req.cookies?.studyduel_session || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
  const payload = token ? verifySessionToken(token) : null;
  if (payload?.jti) {
    try {
      await query('UPDATE login_sessions SET ended_at = now() WHERE id = $1 AND ended_at IS NULL', [payload.jti]);
    } catch (error) {
      console.error('[Login session close error]:', error.message);
    }
  }
  clearSessionCookie(res);
  return res.json({ success: true });
});
