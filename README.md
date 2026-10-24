# StudyDuel

StudyDuel is a React and Express study timer with PostgreSQL-backed authentication and account workspace persistence. The repository also contains a browser extension. Some social features are still local-only.

## Current functionality

- Email and password registration and login, with Argon2id password hashes and JWT sessions in HTTP-only cookies.
- Optional Google sign-in when `GOOGLE_CLIENT_ID` is configured.
- Timer, dashboard, project management, settings, and compare screens.
- Light and dark themes, timer/session views, dashboard summaries, and browser extension UI.
- An Express API with health, authentication, project, timer, and account-workspace endpoints.

### Data storage

Authentication records and signed-in workspace data are stored in PostgreSQL. The React app keeps a `localStorage` copy for responsive UI, then syncs account-scoped workspace keys to the `user_workspace_state` JSONB table. This includes projects and subjects, completed sessions, the active timer, goals/plans, dashboard layout, preferences, reminders, and the local friend list. Signing into the same account in another browser loads the shared workspace. Existing browser data is imported once when no server workspace exists; server state takes precedence on later logins. The timer stores its start time and elapsed state, so it continues to advance while the app is open.

The database schema also includes normalized tables for projects, sessions, active timers, goals, and social connections, with project and timer API endpoints. The current React screens use the account workspace JSONB record for persistence rather than those normalized endpoints. The Compare screen's friend list is account-scoped but local to that account; it does not send real invitations or compare data from other accounts. The browser extension has API calls of its own.

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

The initial schema is in [`database/001_initial_schema.sql`](database/001_initial_schema.sql). The additive workspace migration is in [`database/002_user_workspace_state.sql`](database/002_user_workspace_state.sql). The server applies the workspace migration idempotently at startup.

Stop the local database while preserving its data:

```bash
docker compose down
```

Remove the local database volume and its data (destructive):

```bash
docker compose down -v
```

Add future migrations as new numbered SQL files and apply them idempotently during server startup or through a documented deployment procedure.

## Production deployment (manual VPS example)

The repository does not include a CI/CD workflow that deploys on `git push`. A push to GitHub alone does not update a running site. On the server, from the application directory:

```bash
git pull origin main
npm install
npm run build
pm2 restart studyduel2 --update-env
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
