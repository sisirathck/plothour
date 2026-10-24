-- Per-user workspace cache for the existing client data model.
-- The React UI keeps a local copy for responsiveness and syncs each workspace
-- key independently so changes on one device do not replace unrelated keys.
CREATE TABLE IF NOT EXISTS user_workspace_state (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(data) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT now()
);
