# PlotHour Database Schemas

This folder provides consolidated and up-to-date PostgreSQL SQL scripts for PlotHour releases.

## Files

- **`current_schema.sql`**: The single, comprehensive, idempotent schema script for PlotHour (`v0.2.0`). It creates all tables, indices, constraints, and default configuration rows in a single run.

## How to Apply

### 1. Supabase / Neon / Render / Railway Web Console
1. Open your database dashboard (e.g., Supabase SQL Editor, Neon SQL Console).
2. Open and copy the contents of `current_schema.sql`.
3. Paste into the SQL editor and click **Run**.

### 2. Using `psql` CLI
```bash
psql -h <HOST> -U <USER> -d <DATABASE> -f sql/current_schema.sql
```

Or via database connection string:
```bash
psql "$DATABASE_URL" -f sql/current_schema.sql
```

### 3. Automatic Migrations
When starting the PlotHour backend server (`npm run server` or `npm run dev`), the server also automatically detects missing tables and runs the numbered migration scripts located in the `database/` directory.
