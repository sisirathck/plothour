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
import { tasksRouter } from './routes/tasks.js';
import { workspaceRouter } from './routes/workspace.js';
import { connectionsRouter } from './routes/connections.js';
import { adminRouter } from './routes/admin.js';
import { analyticsRouter } from './routes/analytics.js';
import { pool, query } from './db.js';
import { backfillWorkspaceProjections } from './workspaceProjection.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, '../dist');

const app = express();
const PORT = process.env.PORT || 3001;
let databaseReady = false;

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
    status: databaseReady ? 'ok' : 'starting',
    app: 'PlotHour API',
    databaseReady,
    timestamp: new Date().toISOString(),
  });
});

// Do not allow authentication or account routes to silently run before new
// database migrations have finished applying.
app.use('/api', (_req, res, next) => {
  if (!databaseReady) return res.status(503).json({ error: 'The database is starting. Please retry shortly.' });
  return next();
});

// Public, read-only branding and copy used by the client. Admin writes remain
// protected by the authenticated /api/admin router.
app.get('/api/site-config', async (_req, res) => {
  try {
    const result = await query('SELECT config FROM site_customization WHERE id = 1');
    res.setHeader('Cache-Control', 'no-store');
    res.json(result.rows[0]?.config || { copy: {}, visuals: {} });
  } catch (error) {
    if (error.code === '42P01') return res.json({ copy: {}, visuals: {} });
    console.error('[Site config error]:', error);
    res.status(500).json({ error: 'Could not load site customization.' });
  }
});

app.get('/api/site-assets/:assetId', async (req, res) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.assetId)) return res.status(404).end();
  try {
    const result = await query('SELECT mime_type, file_data FROM site_assets WHERE id = $1', [req.params.assetId]);
    const asset = result.rows[0];
    if (!asset) return res.status(404).end();
    res.setHeader('Content-Type', asset.mime_type);
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.send(asset.file_data);
  } catch (error) {
    if (error.code === '42P01') return res.status(404).end();
    console.error('[Site asset error]:', error);
    return res.status(500).end();
  }
});

// Authentication routes
app.use('/api/auth', authRouter);

// Projects and Timer routes
app.use('/api/projects', projectsRouter);
app.use('/api/timer', timerRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/workspace', workspaceRouter);
app.use('/api/connections', connectionsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/analytics', analyticsRouter);

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
  console.log(` PlotHour Server listening on http://localhost:${PORT}`);
  console.log(`==============================================`);

  let migrationClient;
  let migrationLockAcquired = false;
  const migrationLockId = 731904218;
  try {
    migrationClient = await pool.connect();
    // Multiple development workers/restarts can overlap briefly. Serialize
    // schema setup so CREATE TABLE IF NOT EXISTS does not race at the catalog.
    await migrationClient.query('SELECT pg_advisory_lock($1)', [migrationLockId]);
    migrationLockAcquired = true;
    await migrationClient.query('SELECT 1');
    console.log(` [Database] PostgreSQL connected successfully`);

    // Ensure schema tables exist (auto-migration on cold start)
    const tableCheck = await migrationClient.query(`
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
        await migrationClient.query(sql);
        console.log(' [Database] Initial schema successfully applied!');
      }
    }

    // Additive, idempotent migration for per-user workspace persistence.
    const workspaceSchemaPath = path.resolve(__dirname, '../database/002_user_workspace_state.sql');
    if (fs.existsSync(workspaceSchemaPath)) {
      await migrationClient.query(fs.readFileSync(workspaceSchemaPath, 'utf8'));
    }

    const inviteCodeSchemaPath = path.resolve(__dirname, '../database/003_invite_codes.sql');
    if (fs.existsSync(inviteCodeSchemaPath)) {
      await migrationClient.query(fs.readFileSync(inviteCodeSchemaPath, 'utf8'));
    }

    const emailVerificationSchemaPath = path.resolve(__dirname, '../database/004_email_verification.sql');
    if (fs.existsSync(emailVerificationSchemaPath)) {
      await migrationClient.query(fs.readFileSync(emailVerificationSchemaPath, 'utf8'));
    }

    const passwordResetSchemaPath = path.resolve(__dirname, '../database/005_password_reset.sql');
    if (fs.existsSync(passwordResetSchemaPath)) {
      await migrationClient.query(fs.readFileSync(passwordResetSchemaPath, 'utf8'));
    }

    const adminSchemaPath = path.resolve(__dirname, '../database/006_admin_settings.sql');
    if (fs.existsSync(adminSchemaPath)) {
      await migrationClient.query(fs.readFileSync(adminSchemaPath, 'utf8'));
    }

    const customizationSchemaPath = path.resolve(__dirname, '../database/007_site_customization.sql');
    if (fs.existsSync(customizationSchemaPath)) {
      await migrationClient.query(fs.readFileSync(customizationSchemaPath, 'utf8'));
    }

    const loginSessionsSchemaPath = path.resolve(__dirname, '../database/008_login_sessions.sql');
    if (fs.existsSync(loginSessionsSchemaPath)) {
      await migrationClient.query(fs.readFileSync(loginSessionsSchemaPath, 'utf8'));
    }
    const pageActivitySchemaPath = path.resolve(__dirname, '../database/009_page_activity.sql');
    if (fs.existsSync(pageActivitySchemaPath)) {
      await migrationClient.query(fs.readFileSync(pageActivitySchemaPath, 'utf8'));
    }
    const adminRolesSchemaPath = path.resolve(__dirname, '../database/010_admin_roles.sql');
    if (fs.existsSync(adminRolesSchemaPath)) {
      await migrationClient.query(fs.readFileSync(adminRolesSchemaPath, 'utf8'));
    }
    const relationalUserDataSchemaPath = path.resolve(__dirname, '../database/011_relational_user_data.sql');
    if (fs.existsSync(relationalUserDataSchemaPath)) {
      await migrationClient.query(fs.readFileSync(relationalUserDataSchemaPath, 'utf8'));
      await backfillWorkspaceProjections(migrationClient);
    }
    await migrationClient.query(fs.readFileSync(path.resolve(__dirname, '../database/012_tasks.sql'), 'utf8'));
    await migrationClient.query(fs.readFileSync(path.resolve(__dirname, '../database/013_task_subprojects.sql'), 'utf8'));
    databaseReady = true;
  } catch (err) {
    console.error(` [Database] Connection or migration failed:`, err.message);
  } finally {
    if (migrationClient) {
      if (migrationLockAcquired) {
        try { await migrationClient.query('SELECT pg_advisory_unlock($1)', [migrationLockId]); }
        catch (error) { console.error('[Database] Could not release migration lock:', error.message); }
      }
      migrationClient.release();
    }
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
