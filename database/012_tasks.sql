CREATE TABLE IF NOT EXISTS user_tasks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 title varchar(240) NOT NULL,
 due_date date,
 reminder_date date,
 project_name varchar(240) NOT NULL DEFAULT '',
 completed boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_tasks_owner_due ON user_tasks(user_id, due_date);
