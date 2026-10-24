-- Site-wide, admin-managed visual and copy settings plus uploaded raster assets.
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
