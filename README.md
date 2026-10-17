# StudyDuel

StudyDuel is an open-source time-tracking and friendly accountability app for people who study or work toward shared goals. It is being built around reliable project-based timers, personal insights, and opt-in comparisons with friends.

See [PRODUCT_GUIDE.md](PRODUCT_GUIDE.md) for the product goals, requirements, privacy model, and suggested implementation sequence.

## Current status

The repository currently contains the React/Vite frontend and a PostgreSQL schema for the planned product. Select **Try demo** on the login screen to open the guest dashboard with sample data. This demo does not create or authenticate an account, and its timer is temporary browser state. Production authentication, a timer API, and a database connection from the frontend are not implemented yet. The database setup below creates a local development database and its initial tables.

## Prerequisites

- Node.js and npm
- Docker with Docker Compose

## Run the frontend

```sh
npm install
npm run dev
```

## Start the local database

Copy the example environment file and change the local password:

```sh
cp .env.example .env
```

Start PostgreSQL:

```sh
docker compose up -d db
```

On its first start with an empty data volume, PostgreSQL runs [`database/001_initial_schema.sql`](database/001_initial_schema.sql) and creates the initial StudyDuel tables. The local database is published only on `127.0.0.1:5432`.

Check its status:

```sh
docker compose ps
```

To stop the database while preserving its data:

```sh
docker compose down
```

To permanently remove the local database and its data volume, run `docker compose down -v`. This is destructive and should only be used for local development data you are willing to lose.

The database currently provides the schema foundation only. A backend, migration runner, API authorization, account flows, and frontend database integration still need to be implemented. For this initial schema, changes to an already initialized database should be made as new numbered SQL migration files rather than by editing the initial migration. Apply a later migration with:

```sh
docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < database/002_next_migration.sql
```

## Contributing

Contributions are welcome. Keep changes aligned with the product guide, document setup and behavior, and use synthetic data in demos. Never commit `.env` files, OAuth secrets, production database credentials, or real tracking histories.

Before public release, add the project's chosen open-source license and a `SECURITY.md` explaining how to report vulnerabilities. A public repository without a license does not grant permission to reuse its code.

## License

No license has been selected yet. Until one is added, the repository should not be presented as licensed for reuse.
