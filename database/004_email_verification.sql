-- Add one-time email verification for new password-based registrations.
-- Existing accounts are treated as verified so they are not locked out.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT true;

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

ALTER TABLE email_verification_challenges
  ADD COLUMN IF NOT EXISTS send_window_started_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE email_verification_challenges
  ADD COLUMN IF NOT EXISTS send_count smallint NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS email_verification_challenges_expires_idx
  ON email_verification_challenges (expires_at);
