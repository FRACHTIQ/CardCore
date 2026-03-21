-- Admin-Rolle, Verifizierung, Sperre (bestehende DBs)

ALTER TABLE app_user
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';

ALTER TABLE app_user DROP CONSTRAINT IF EXISTS app_user_role_check;
ALTER TABLE app_user ADD CONSTRAINT app_user_role_check CHECK (role IN ('user', 'admin'));

ALTER TABLE app_user
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE app_user
  ADD COLUMN IF NOT EXISTS verification_note TEXT NOT NULL DEFAULT '';

ALTER TABLE app_user
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_app_user_role ON app_user (role);
CREATE INDEX IF NOT EXISTS idx_app_user_suspended ON app_user (suspended_at) WHERE suspended_at IS NOT NULL;
