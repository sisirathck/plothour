import { verifySessionToken } from './auth.js';

export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const token = req.cookies?.studyduel_session || bearerToken;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const payload = verifySessionToken(token);
  if (!payload || !payload.userId) {
    return res.status(401).json({ error: 'Invalid or expired session token' });
  }

  req.userId = payload.userId;
  req.userEmail = payload.email;
  next();
}
