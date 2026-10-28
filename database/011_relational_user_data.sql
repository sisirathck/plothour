-- Relational, account-owned projection of the browser workspace.
-- This migration is additive: the legacy user_workspace_state JSON remains
-- untouched as a rollback/recovery source while clients move to these tables.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS deadline date,
  ADD COLUMN IF NOT EXISTS favorite boolean NOT NULL DEFAULT false;

ALTER TABLE subprojects
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS deadline date,
  ADD COLUMN IF NOT EXISTS estimate_seconds bigint
    CHECK (estimate_seconds IS NULL OR estimate_seconds >= 0);

CREATE TABLE IF NOT EXISTS subproject_goals (
  subproject_id uuid NOT NULL REFERENCES subprojects(id) ON DELETE CASCADE,
  cadence text NOT NULL CHECK (cadence IN ('daily', 'weekly', 'monthly')),
  target_hours numeric(10, 2) NOT NULL DEFAULT 0 CHECK (target_hours >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (subproject_id, cadence)
);

CREATE TABLE IF NOT EXISTS subproject_study_days (
  subproject_id uuid NOT NULL REFERENCES subprojects(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  PRIMARY KEY (subproject_id, weekday)
);

CREATE TABLE IF NOT EXISTS milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subproject_id uuid NOT NULL REFERENCES subprojects(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(trim(title)) > 0),
  completed boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS milestones_subproject_sort_idx
  ON milestones (subproject_id, sort_order);

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  theme text,
  theme_mode text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dashboard_preferences (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  layout jsonb NOT NULL DEFAULT '{}'::jsonb,
  date_range text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS compare_preferences (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  selected_profile_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  profile_colors jsonb NOT NULL DEFAULT '{}'::jsonb,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_reminders (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reminder_deliveries (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reminder_key text NOT NULL,
  delivered_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, reminder_key)
);

CREATE TABLE IF NOT EXISTS session_activity (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_key text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, activity_key)
);

CREATE TABLE IF NOT EXISTS user_streaks (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  current_streak integer NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
  longest_streak integer NOT NULL DEFAULT 0 CHECK (longest_streak >= 0),
  calculated_through date,
  updated_at timestamptz NOT NULL DEFAULT now()
);
