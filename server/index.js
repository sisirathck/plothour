import express from 'express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { authRouter } from './routes/auth.js';
import { projectsRouter } from './routes/projects.js';
import { timerRouter } from './routes/timer.js';
import { workspaceRouter } from './routes/workspace.js';
import { query } from './db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, '../dist');

const app = express();
const PORT = process.env.PORT || 3001;

// Enable gzip/deflate/brotli HTTP response compression
app.use(compression());

// CORS configuration to support browser extensions (chrome-extension://, moz-extension://, safari-web-extension://, etc.)
app.use(cors({
  origin: true,
  credentials: true,
}));

// Body & Cookie parsers
app.use(express.json({ limit: '10mb' }));
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
app.use('/api/workspace', workspaceRouter);

// Serve frontend static build if dist/ exists (Production mode)
if (fs.existsSync(distPath)) {
  console.log(` [Static] Serving frontend from ${distPath}`);

  // Serve static assets with high-performance caching headers
  app.use(express.static(distPath, {
    maxAge: '7d', // 7 days default for static assets (images, icons, etc.)
    setHeaders: (res, filePath) => {
      // Content-hashed bundles in dist/assets can be cached immutably for 1 year
      if (filePath.includes(path.sep + 'assets' + path.sep) || filePath.includes('/assets/')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else if (filePath.endsWith('.html')) {
        // Never cache HTML so updates/deployments take effect immediately
        res.setHeader('Cache-Control', 'no-cache');
      }
    }
  }));

  // SPA fallback: any non-API GET request serves dist/index.html
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      res.setHeader('Cache-Control', 'no-cache');
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

    // Ensure schema tables exist (auto-migration on cold start)
    const tableCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);
    if (!tableCheck.rows[0]?.exists) {
      console.log(' [Database] "users" table missing. Applying 001_initial_schema.sql...');
      const schemaPath = path.resolve(__dirname, '../database/001_initial_schema.sql');
      if (fs.existsSync(schemaPath)) {
        const sql = fs.readFileSync(schemaPath, 'utf8');
        await query(sql);
        console.log(' [Database] Initial schema successfully applied!');
      }
    }

    // Additive, idempotent migration for per-user workspace persistence.
    const workspaceSchemaPath = path.resolve(__dirname, '../database/002_user_workspace_state.sql');
    if (fs.existsSync(workspaceSchemaPath)) {
      await query(fs.readFileSync(workspaceSchemaPath, 'utf8'));
    }
  } catch (err) {
    console.error(` [Database] Connection or migration failed:`, err.message);
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
