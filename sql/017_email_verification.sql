-- E-Mail-Verifizierung: 6-stelliger Code per SMTP (services/mailer.js)

ALTER TABLE app_user
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

UPDATE app_user
SET email_verified_at = COALESCE(email_verified_at, created_at)
WHERE email_verified_at IS NULL;

CREATE TABLE IF NOT EXISTS email_verification_otp (
  user_id INTEGER NOT NULL PRIMARY KEY REFERENCES app_user (id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_verification_otp_expires
  ON email_verification_otp (expires_at);
