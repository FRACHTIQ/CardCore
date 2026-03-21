-- Push-Tokens (Expo) für Broadcast bei neuen Listings
-- In Railway PostgreSQL ausführen.

CREATE TABLE IF NOT EXISTS user_push_token (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  expo_push_token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (expo_push_token)
);

CREATE INDEX IF NOT EXISTS idx_user_push_token_user ON user_push_token (user_id);
