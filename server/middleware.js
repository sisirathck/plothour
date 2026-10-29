import { query } from './db.js';
import { verifySessionToken } from './auth.js';

export async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const token = bearerToken || req.cookies?.studyduel_session;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const payload = verifySessionToken(token);
  if (!payload || !payload.userId) {
    return res.status(401).json({ error: 'Invalid or expired session token' });
  }

  try {
    if (payload.jti) {
      const session = await query('SELECT 1 FROM login_sessions WHERE id=$1 AND user_id=$2 AND ended_at IS NULL AND expires_at>now()', [payload.jti,payload.userId]);
      if (!session.rows.length) return res.status(401).json({ error: 'Your session ended. Please sign in again.' });
    }
  } catch { return res.status(503).json({ error: 'Could not verify your session. Please retry.' }); }
  req.userId = payload.userId;
  req.userEmail = payload.email;
  next();
}
