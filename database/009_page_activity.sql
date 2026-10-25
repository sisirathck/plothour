-- Aggregate authenticated foreground time spent in each PlotHour section.
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
