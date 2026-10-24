# StudyDuel

StudyDuel is a React and Express study timer with a PostgreSQL-backed authentication service. The repository also contains a browser extension. This README describes the current implementation; some planned social and persistence features are not yet connected to the main app.

## Current functionality

- Email and password registration with emailed verification codes, Argon2id password hashes, and JWT sessions in HTTP-only cookies.
- Optional Google sign-in when `GOOGLE_CLIENT_ID` is configured.
- Timer, dashboard, project management, settings, and compare screens.
- Light and dark themes, timer/session views, dashboard summaries, and browser extension UI.
- An Express API with health, authentication, project-list/create, and timer endpoints.

### Current data-storage limitation

Authentication records are stored in PostgreSQL. The main React app currently stores most signed-in workspace data in browser `localStorage`, including projects and subjects, completed sessions, the active timer, goals/plans, dashboard layout, preferences, reminders, and the local friend list. That data is browser- and device-specific; it is not reliably backed up or available on another device.

The database schema includes tables for projects, sessions, active timers, goals, and social connections, and the server has project and timer endpoints. However, the main React screens do not currently use those endpoints as their source of truth. As a result, the active timer and most information shown in the UI are **not currently derived from PostgreSQL**. The Compare screen's friend list is local-only; it does not send real invitations or compare data from other accounts. The browser extension has API calls of its own, but that does not make the web app's local data database-backed.

The demo mode intentionally uses local sample data. A new signed-in account should start without sample projects; sample projects are for demo mode only.

## Technology

| Layer | Technologies |
|---|---|
| Frontend | React 19, Vite 8, Lucide React, CSS |
| Backend | Node.js, Express 5 |
| Authentication | Argon2id, JWT, HTTP-only cookies, optional Google Identity Services |
| Database | PostgreSQL 16, `pg` connection pool |
| Extension | Manifest V3 browser extension |

## Requirements

- Node.js `^20.19.0` or `>=22.12.0` (Vite 8 requirement)
- npm
- Docker Compose for the local PostgreSQL service, or an existing PostgreSQL database

## Local setup

Clone this repository and install dependencies:

```bash
git clone https://github.com/sisirathck/studyduel-2.0.git
cd studyduel-2.0
npm install
```

Create a local environment file and set a strong `AUTH_SECRET`:

```bash
cp .env.example .env
```

For Docker Compose, set `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB`; set `DATABASE_URL` to match them. Then start PostgreSQL and the app:

```bash
docker compose up -d db
npm run dev
```

Vite serves the frontend at <http://localhost:5173> and proxies `/api` requests to Express at <http://localhost:3001>. On first server startup, the server applies `database/001_initial_schema.sql` if it cannot find the `users` table. Docker also runs that SQL file when it initializes a new data volume.

Use **Try demo** to explore the sample workspace, or register an account to use the authentication flow.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AUTH_SECRET` | Yes for secure deployment | Secret used to sign session JWTs; use a random value of at least 32 bytes |
| `PORT` | No | Express listen port; defaults to `3001` |
| `NODE_ENV` | No | Set to `production` in production so session cookies use the `Secure` flag |
| `GOOGLE_CLIENT_ID` | No | Enables Google sign-in when configured |
| `RESEND_API_KEY` | Required for password-based registration | API key used to send verification emails through Resend |
| `EMAIL_FROM` | Required for password-based registration | Verified sender, for example `StudyDuel <verify@example.com>` |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | For Docker Compose | PostgreSQL container setup |

Do not use the development fallback JWT secret in production. Keep `.env` and all credentials out of version control.

## Useful commands

| Command | Purpose |
|---|---|
| `npm run dev` | Run Vite and the Express server for development |
| `npm run build` | Build the frontend into `dist/` |
| `npm start` | Run the Express server, serving `dist/` when present |
| `npm run build:start` | Build the frontend and start the Express server |
| `npm run server` | Run only the Express server |
| `npm run lint` | Run Oxlint |
| `npm run preview` | Preview the Vite production build |

## Database

The initial schema is in [`database/001_initial_schema.sql`](database/001_initial_schema.sql). It defines users, OAuth accounts, projects, subprojects, time entries, active timers, goals, and social/challenge tables. The presence of a schema table does not mean the corresponding UI feature is already connected to it; see [Current data-storage limitation](#current-data-storage-limitation).

Stop the local database while preserving its data:

```bash
docker compose down
```

Remove the local database volume and its data (destructive):

```bash
docker compose down -v
```

The server applies the numbered additive SQL migrations on startup. Email verification is enabled only when `RESEND_API_KEY` and a verified `EMAIL_FROM` sender are configured. New password accounts are created after the 6-digit code is verified; existing accounts remain verified. Google sign-in requires a Google-verified email.

## Production deployment (manual VPS example)

The repository does not include a CI/CD workflow that deploys on `git push`. A push to GitHub alone does not update a running site. On the server, from the application directory:

```bash
git pull origin main
npm install
npm run build
pm2 restart studyduel --update-env
```

For a first-time PM2 launch, use `pm2 start npm --name studyduel -- start`, then `pm2 save`. Configure the reverse proxy (for example, Nginx) to pass requests to the Express port, which defaults to `3001`. Adjust the PM2 process name and deployment commands to match the server's actual setup.

## Repository layout

```text
database/                 PostgreSQL schema
extension/                Manifest V3 browser extension
public/                   Static images and icons
scripts/                  Development and asset scripts
server/                   Express API and authentication
src/components/           Shared React UI
src/context/               Theme context
src/modules/                Timer, dashboard, manage, compare, settings
```

## Contributing

Use synthetic data for screenshots and examples. Never commit `.env` files, production credentials, personal tracking data, or user exports. Please ensure documentation reflects the implementation and label planned features clearly.
