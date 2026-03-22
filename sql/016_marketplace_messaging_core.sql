-- Kernschema für Listings, Chats, Push-Tokens und Antwortzeit-Metrik (idempotent).
-- Wenn Tabellen/Enums in Railway schon existieren, werden sie übersprungen.

DO $$
BEGIN
  CREATE TYPE listing_status AS ENUM ('DRAFT', 'ACTIVE', 'SOLD', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE card_type AS ENUM ('BASE', 'PARALLEL', 'AUTO', 'ROOKIE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS listing (
  id SERIAL PRIMARY KEY,
  seller_id INTEGER NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  sport TEXT NOT NULL DEFAULT '',
  manufacturer TEXT NOT NULL DEFAULT '',
  set_name TEXT NOT NULL DEFAULT '',
  year INTEGER NOT NULL DEFAULT 0,
  player_name TEXT NOT NULL DEFAULT '',
  team TEXT NOT NULL DEFAULT '',
  card_number TEXT NOT NULL DEFAULT '',
  card_type card_type NOT NULL DEFAULT 'BASE',
  condition_grade TEXT NOT NULL DEFAULT '',
  price_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'EUR',
  description TEXT NOT NULL DEFAULT '',
  status listing_status NOT NULL DEFAULT 'DRAFT',
  is_welcome_anchor BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_listing_seller_status ON listing (seller_id, status);
CREATE INDEX IF NOT EXISTS idx_listing_status_created ON listing (status, created_at DESC);

CREATE TABLE IF NOT EXISTS conversation (
  id SERIAL PRIMARY KEY,
  listing_id INTEGER NOT NULL REFERENCES listing (id) ON DELETE CASCADE,
  buyer_id INTEGER NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  seller_id INTEGER NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ,
  UNIQUE (listing_id, buyer_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_buyer ON conversation (buyer_id, last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_conversation_seller ON conversation (seller_id, last_message_at DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS message (
  id BIGSERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversation (id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  body TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_conversation_created ON message (conversation_id, created_at);

CREATE TABLE IF NOT EXISTS user_push_token (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  expo_push_token TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, expo_push_token)
);

CREATE INDEX IF NOT EXISTS idx_user_push_token_user ON user_push_token (user_id);

ALTER TABLE app_user
  ADD COLUMN IF NOT EXISTS avg_response_hours NUMERIC(10, 2);

ALTER TABLE app_user
  ADD COLUMN IF NOT EXISTS response_metric_samples INTEGER NOT NULL DEFAULT 0;
