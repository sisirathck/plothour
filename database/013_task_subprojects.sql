ALTER TABLE user_tasks
  ADD COLUMN IF NOT EXISTS subproject_name varchar(240) NOT NULL DEFAULT '';
