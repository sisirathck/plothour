-- Add one-time password reset verification challenges for users who forgot their password.
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

ALTER TABLE password_reset_challenges
  ADD COLUMN IF NOT EXISTS send_window_started_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE password_reset_challenges
  ADD COLUMN IF NOT EXISTS send_count smallint NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS password_reset_challenges_expires_idx
  ON password_reset_challenges (expires_at);
