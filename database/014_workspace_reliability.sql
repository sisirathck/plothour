ALTER TABLE active_timers ADD COLUMN IF NOT EXISTS paused_at timestamptz;
ALTER TABLE active_timers ADD COLUMN IF NOT EXISTS paused_seconds double precision NOT NULL DEFAULT 0;
ALTER TABLE active_timers ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'stopwatch';
ALTER TABLE active_timers ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES user_tasks(id) ON DELETE SET NULL;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES user_tasks(id) ON DELETE SET NULL;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'stopwatch';
CREATE TABLE IF NOT EXISTS timer_commands (
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 command_id uuid NOT NULL,
 response jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id, command_id)
);
CREATE TABLE IF NOT EXISTS comparison_sharing (
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 partner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 project_ids uuid[] NOT NULL DEFAULT '{}',
 share_project_names boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id, partner_id)
);
ALTER TABLE email_report_deliveries ADD COLUMN IF NOT EXISTS error_message text;
ALTER TABLE email_report_deliveries ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 1;
ALTER TABLE email_report_deliveries DROP CONSTRAINT IF EXISTS email_report_deliveries_status_check;
ALTER TABLE email_report_deliveries ADD CONSTRAINT email_report_deliveries_status_check CHECK(status IN ('processing','sent','failed'));
