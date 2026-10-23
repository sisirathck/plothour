import express from 'express';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { authRouter } from './routes/auth.js';
import { projectsRouter } from './routes/projects.js';
import { timerRouter } from './routes/timer.js';
import { query } from './db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, '../dist');

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration to support browser extensions (chrome-extension://, moz-extension://, safari-web-extension://, etc.)
app.use(cors({
  origin: true,
  credentials: true,
}));

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

// Projects and Timer routes
app.use('/api/projects', projectsRouter);
app.use('/api/timer', timerRouter);

// Serve frontend static build if dist/ exists (Production mode)
if (fs.existsSync(distPath)) {
  console.log(` [Static] Serving frontend from ${distPath}`);
  app.use(express.static(distPath));

  // SPA fallback: any non-API GET request serves dist/index.html
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(distPath, 'index.html'));
    }
    next();
  });
}

// 404 for unhandled API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

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
