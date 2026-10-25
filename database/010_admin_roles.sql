-- Persist administrator access on the account instead of depending on the
-- environment of each running API process.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- Keep the explicitly designated PlotHour owner as an administrator.
UPDATE users
SET is_admin = true
WHERE lower(email) = 'sisirathsck@gmail.com'
  AND email_verified = true;
