-- Persist account invite codes so connections can be created across devices.
CREATE TABLE IF NOT EXISTS user_invite_codes (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE CHECK (code ~ '^DUEL-[0-9A-F]{10}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_invite_codes_code_idx ON user_invite_codes (code);
