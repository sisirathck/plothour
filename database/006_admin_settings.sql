-- Admin-managed operational settings. The singleton row is created on startup.
CREATE TABLE IF NOT EXISTS app_admin_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  signups_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO app_admin_settings (id, signups_enabled)
VALUES (1, true)
ON CONFLICT (id) DO NOTHING;
