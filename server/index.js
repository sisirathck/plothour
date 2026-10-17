import express from 'express';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { authRouter } from './routes/auth.js';
import { query } from './db.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Body & Cookie parsers
app.use(express.json());
app.use(cookieParser());

// Healthcheck
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'StudyDuel API',
    timestamp: new Date().toISOString(),
  });
});

// Authentication routes
app.use('/api/auth', authRouter);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Server Error]:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, async () => {
  console.log(`\n==============================================`);
  console.log(` StudyDuel Server listening on http://localhost:${PORT}`);
  console.log(`==============================================`);

  try {
    await query('SELECT 1');
    console.log(` [Database] PostgreSQL connected successfully`);
  } catch (err) {
    console.error(` [Database] Connection failed:`, err.message);
  }

  if (process.env.AUTH_SECRET) {
    console.log(` [Auth] AUTH_SECRET is configured`);
  } else {
    console.warn(` [Auth] WARNING: AUTH_SECRET is not set!`);
  }

  if (process.env.GOOGLE_CLIENT_ID) {
    console.log(` [OAuth] Google Client ID is configured`);
  } else {
    console.log(` [OAuth] Google OAuth not configured yet (add GOOGLE_CLIENT_ID to .env)`);
  }
  console.log(`==============================================\n`);
});
