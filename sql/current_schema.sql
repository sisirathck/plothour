-- ==============================================================================
-- PlotHour Full Database Schema (v0.2.0)
-- 
-- Compatible with PostgreSQL 14+, Neon, Supabase, Amazon RDS, and Railway.
-- This file creates all tables, relationships, constraints, indexes, and initial
-- seed rows required to run PlotHour in a single, safe, idempotent execution.
-- ==============================================================================

-- Enable UUID extension if not already present
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. USERS & AUTHENTICATION
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  display_name text NOT NULL,
  password_hash text,
  is_admin boolean NOT NULL DEFAULT false,
  email_verified boolean NOT NULL DEFAULT true,
  timezone text NOT NULL DEFAULT 'UTC',
  week_starts_on smallint NOT NULL DEFAULT 1 CHECK (week_starts_on BETWEEN 0 AND 6),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure case-insensitive unique emails
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique ON users (lower(email));

-- Ensure is_admin and email_verified exist if upgrading from older schemas
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT true;

-- OAuth accounts (e.g. Google Sign-In)
CREATE TABLE IF NOT EXISTS oauth_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('google')),
  provider_subject text NOT NULL,
  email_at_provider text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_subject),
  UNIQUE (user_id, provider)
);

CREATE INDEX IF NOT EXISTS oauth_accounts_user_id_idx ON oauth_accounts (user_id);

-- One-time email verification challenges for registrations
CREATE TABLE IF NOT EXISTS email_verification_challenges (
  email text PRIMARY KEY,
  display_name text NOT NULL,
  password_hash text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  send_window_started_at timestamptz NOT NULL DEFAULT now(),
  send_count smallint NOT NULL DEFAULT 1 CHECK (send_count BETWEEN 1 AND 3),
  attempts smallint NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_verification_challenges_expires_idx
  ON email_verification_challenges (expires_at);

-- One-time password reset verification challenges
CREATE TABLE IF NOT EXISTS password_reset_challenges (
  email text PRIMARY KEY,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  send_window_started_at timestamptz NOT NULL DEFAULT now(),
  send_count smallint NOT NULL DEFAULT 1 CHECK (send_count BETWEEN 1 AND 5),
  attempts smallint NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS password_reset_challenges_expires_idx
  ON password_reset_challenges (expires_at);

-- ------------------------------------------------------------------------------
-- 2. PROJECTS & TASKS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  color text CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order integer NOT NULL DEFAULT 0,
  archived_at timestamptz,
  start_date date,
  deadline date,
  favorite boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, user_id)
);

CREATE INDEX IF NOT EXISTS projects_user_sort_idx ON projects (user_id, sort_order);

CREATE TABLE IF NOT EXISTS subprojects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  parent_subproject_id uuid,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  color text CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order integer NOT NULL DEFAULT 0,
  archived_at timestamptz,
  start_date date,
  deadline date,
  estimate_seconds bigint CHECK (estimate_seconds IS NULL OR estimate_seconds >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, project_id),
  FOREIGN KEY (parent_subproject_id, project_id)
    REFERENCES subprojects(id, project_id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS subprojects_project_parent_sort_idx
  ON subprojects (project_id, parent_subproject_id, sort_order);

-- ------------------------------------------------------------------------------
-- 3. TIME TRACKING & LOGS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL,
  subproject_id uuid,
  started_at timestamptz NOT NULL,
  ended_at timestamptz NOT NULL,
  note text,
  source text NOT NULL DEFAULT 'timer' CHECK (source IN ('timer', 'manual')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ended_at > started_at),
  FOREIGN KEY (project_id, user_id)
    REFERENCES projects(id, user_id)
    ON DELETE RESTRICT,
  FOREIGN KEY (subproject_id, project_id)
    REFERENCES subprojects(id, project_id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS time_entries_user_started_idx
  ON time_entries (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS time_entries_user_project_started_idx
  ON time_entries (user_id, project_id, started_at DESC);
CREATE INDEX IF NOT EXISTS time_entries_user_subproject_started_idx
  ON time_entries (user_id, subproject_id, started_at DESC);

-- Active live timer per user
CREATE TABLE IF NOT EXISTS active_timers (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL,
  subproject_id uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  note text,
  FOREIGN KEY (project_id, user_id)
    REFERENCES projects(id, user_id)
    ON DELETE RESTRICT,
  FOREIGN KEY (subproject_id, project_id)
    REFERENCES subprojects(id, project_id)
    ON DELETE RESTRICT
);

-- Goals (daily / weekly targets)
CREATE TABLE IF NOT EXISTS goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cadence text NOT NULL CHECK (cadence IN ('daily', 'weekly')),
  target_seconds integer NOT NULL CHECK (target_seconds > 0),
  starts_on date NOT NULL DEFAULT CURRENT_DATE,
  ends_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on IS NULL OR ends_on >= starts_on)
);

CREATE INDEX IF NOT EXISTS goals_user_cadence_dates_idx
  ON goals (user_id, cadence, starts_on, ends_on);

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

-- ------------------------------------------------------------------------------
-- 4. SOCIAL, CHALLENGES & COLLABORATION
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS friend_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  CHECK (sender_user_id <> recipient_user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS friend_invitations_one_pending_pair
  ON friend_invitations (
    LEAST(sender_user_id, recipient_user_id),
    GREATEST(sender_user_id, recipient_user_id)
  )
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS friendships (
  user_low_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_high_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  share_project_names boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_low_id, user_high_id),
  CHECK (user_low_id < user_high_id)
);

CREATE TABLE IF NOT EXISTS challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(trim(title)) > 0),
  target_seconds integer NOT NULL CHECK (target_seconds > 0),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS challenge_participants (
  challenge_id uuid NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (challenge_id, user_id)
);

-- Invite codes for cross-device discovery
CREATE TABLE IF NOT EXISTS user_invite_codes (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE CHECK (code ~ '^DUEL-[0-9A-F]{10}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_invite_codes_code_idx ON user_invite_codes (code);

-- ------------------------------------------------------------------------------
-- 5. CLIENT WORKSPACE SYNC CACHE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_workspace_state (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(data) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT now()
);

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

-- ------------------------------------------------------------------------------
-- 6. ADMIN SETTINGS, BRANDING & CUSTOMIZATION
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_admin_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  signups_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO app_admin_settings (id, signups_enabled)
VALUES (1, true)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS site_customization (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO site_customization (id, config)
VALUES (1, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS site_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot text NOT NULL CHECK (slot IN ('login', 'dashboard', 'logo')),
  theme text NOT NULL CHECK (theme IN ('light', 'dark')),
  file_name text NOT NULL,
  mime_type text NOT NULL CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/webp')),
  file_data bytea NOT NULL,
  byte_size integer NOT NULL CHECK (byte_size BETWEEN 1 AND 5242880),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS site_assets_slot_theme_created_idx
  ON site_assets (slot, theme, created_at DESC);

-- ------------------------------------------------------------------------------
-- 7. ANALYTICS, SESSIONS & ACTIVITY TRACKING
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS login_sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  auth_method text NOT NULL CHECK (auth_method IN ('password', 'google', 'password_signup', 'password_reset')),
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  ended_at timestamptz
);

CREATE INDEX IF NOT EXISTS login_sessions_user_created_idx
  ON login_sessions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS login_sessions_active_idx
  ON login_sessions (user_id, expires_at DESC)
  WHERE ended_at IS NULL;

CREATE TABLE IF NOT EXISTS user_page_activity (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  page text NOT NULL CHECK (page IN ('timer', 'dashboard', 'compare', 'manage', 'settings', 'calendar', 'admin')),
  activity_date date NOT NULL DEFAULT current_date,
  duration_seconds integer NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, page, activity_date)
);

CREATE INDEX IF NOT EXISTS user_page_activity_user_day_idx
  ON user_page_activity (user_id, activity_date DESC);

-- ------------------------------------------------------------------------------
-- 8. INITIAL ADMIN ACCOUNT PROMOTION
-- ------------------------------------------------------------------------------
-- Ensure primary designated owner account is marked as administrator
UPDATE users
SET is_admin = true
WHERE lower(email) = 'sisirathsck@gmail.com'
  AND email_verified = true;
