-- Record each successful web sign-in and its lifecycle for the admin activity view.
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
