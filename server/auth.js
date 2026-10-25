import argon2 from 'argon2';
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import dotenv from 'dotenv';

dotenv.config();

const AUTH_SECRET = process.env.AUTH_SECRET || 'studyduel-development-fallback-secret-key-32b';
const COOKIE_NAME = 'studyduel_session';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Hash password using Argon2id (OWASP recommended parameters)
 */
export async function hashPassword(plainPassword) {
  return argon2.hash(plainPassword, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB
    timeCost: 3,
    parallelism: 4,
  });
}

/**
 * Verify plaintext password against stored Argon2id hash
 */
export async function verifyPassword(passwordHash, plainPassword) {
  if (!passwordHash || !plainPassword) return false;
  try {
    return await argon2.verify(passwordHash, plainPassword);
  } catch (err) {
    console.error('[Auth] Error verifying password:', err);
    return false;
  }
}

/**
 * Generate signed JWT session token
 */
export function createSessionToken(user) {
  return jwt.sign(
    {
      jti: randomUUID(),
      userId: user.id,
      email: user.email,
      displayName: user.display_name,
    },
    AUTH_SECRET,
    { expiresIn: '7d' }
  );
}

/**
 * Verify JWT session token
 */
export function verifySessionToken(token) {
  try {
    return jwt.verify(token, AUTH_SECRET);
  } catch {
    return null;
  }
}

/**
 * Set secure HTTP-only session cookie
 */
export function setSessionCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  });
}

/**
 * Clear session cookie on sign out
 */
export function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
}

/**
 * Safely verify Google ID token received from Google Identity Services
 */
export async function verifyGoogleIdToken(idToken) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error('GOOGLE_CLIENT_ID is not configured in .env');
  }

  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: clientId,
  });

  const payload = ticket.getPayload();
  if (!payload || !payload.sub || !payload.email) {
    throw new Error('Invalid Google token payload');
  }

  return {
    sub: payload.sub,
    email: payload.email,
    emailVerified: payload.email_verified === true,
    displayName: payload.name || payload.email.split('@')[0],
    picture: payload.picture,
  };
}
