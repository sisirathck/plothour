-- PlotHour initial PostgreSQL schema.
-- All timestamps are stored as timestamptz (UTC instants) and rendered in each
-- user's configured timezone by the application.

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  display_name text NOT NULL,
  password_hash text,
  is_admin boolean NOT NULL DEFAULT false,
  timezone text NOT NULL DEFAULT 'UTC',
  week_starts_on smallint NOT NULL DEFAULT 1 CHECK (week_starts_on BETWEEN 0 AND 6),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_email_lower_unique ON users (lower(email));

CREATE TABLE oauth_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('google')),
  provider_subject text NOT NULL,
  email_at_provider text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_subject),
  UNIQUE (user_id, provider)
);

CREATE INDEX oauth_accounts_user_id_idx ON oauth_accounts (user_id);

CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  color text CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order integer NOT NULL DEFAULT 0,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, user_id)
);

CREATE INDEX projects_user_sort_idx ON projects (user_id, sort_order);

-- A project may have no subprojects. Nested subprojects support optional
-- subject/task levels while ensuring every subproject belongs to one project.
CREATE TABLE subprojects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  parent_subproject_id uuid,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  color text CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order integer NOT NULL DEFAULT 0,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, project_id),
  FOREIGN KEY (parent_subproject_id, project_id)
    REFERENCES subprojects(id, project_id)
    ON DELETE RESTRICT
);

CREATE INDEX subprojects_project_parent_sort_idx
  ON subprojects (project_id, parent_subproject_id, sort_order);

CREATE TABLE time_entries (
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

CREATE INDEX time_entries_user_started_idx
  ON time_entries (user_id, started_at DESC);
CREATE INDEX time_entries_user_project_started_idx
  ON time_entries (user_id, project_id, started_at DESC);
CREATE INDEX time_entries_user_subproject_started_idx
  ON time_entries (user_id, subproject_id, started_at DESC);

-- A single row per user makes concurrent timer starts conflict safely. The
-- application calculates elapsed display time from started_at; it does not
-- need a continuously running server process or per-second database writes.
-- project_id is required and subproject_id is optional. On a timer switch, the
-- backend must lock the user's timer state, close the old time entry using its
-- existing project/subproject, then update this row with the new selection and
-- the same server timestamp in one transaction.
CREATE TABLE active_timers (
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

CREATE TABLE goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cadence text NOT NULL CHECK (cadence IN ('daily', 'weekly')),
  target_seconds integer NOT NULL CHECK (target_seconds > 0),
  starts_on date NOT NULL DEFAULT CURRENT_DATE,
  ends_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on IS NULL OR ends_on >= starts_on)
);

CREATE INDEX goals_user_cadence_dates_idx
  ON goals (user_id, cadence, starts_on, ends_on);

CREATE TABLE friend_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  CHECK (sender_user_id <> recipient_user_id)
);

CREATE UNIQUE INDEX friend_invitations_one_pending_pair
  ON friend_invitations (
    LEAST(sender_user_id, recipient_user_id),
    GREATEST(sender_user_id, recipient_user_id)
  )
  WHERE status = 'pending';

CREATE TABLE friendships (
  user_low_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_high_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  share_project_names boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_low_id, user_high_id),
  CHECK (user_low_id < user_high_id)
);

CREATE TABLE challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(trim(title)) > 0),
  target_seconds integer NOT NULL CHECK (target_seconds > 0),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

CREATE TABLE challenge_participants (
  challenge_id uuid NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (challenge_id, user_id)
);
