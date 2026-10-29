CREATE TABLE IF NOT EXISTS email_report_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'unsubscribed')),
  token_hash text,
  unsubscribe_token_hash text,
  invited_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  UNIQUE (user_id, email)
);
ALTER TABLE email_report_recipients ADD COLUMN IF NOT EXISTS unsubscribe_token_hash text;

CREATE INDEX IF NOT EXISTS email_report_recipients_user_status_idx
  ON email_report_recipients(user_id, status);

CREATE TABLE IF NOT EXISTS email_report_deliveries (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  schedule_id text NOT NULL,
  period_key text NOT NULL,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'sent')),
  delivered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, schedule_id, period_key)
);
ALTER TABLE email_report_deliveries ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'sent';
