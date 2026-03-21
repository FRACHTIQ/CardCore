-- CardCore – manuell in Railway PostgreSQL ausführen (keine Auto-Migration)

CREATE TYPE card_type AS ENUM (
  'BASE',
  'NUMBERED',
  'AUTOGRAPH',
  'PATCH',
  'ROOKIE'
);

CREATE TYPE listing_status AS ENUM (
  'DRAFT',
  'ACTIVE',
  'SOLD',
  'ARCHIVED'
);

CREATE TABLE app_user (
  id              SERIAL PRIMARY KEY,
  email           TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  display_name    TEXT NOT NULL DEFAULT '',
  bio             TEXT NOT NULL DEFAULT '',
  legal_name      TEXT NOT NULL DEFAULT '',
  phone           TEXT NOT NULL DEFAULT '',
  street          TEXT NOT NULL DEFAULT '',
  address_extra   TEXT NOT NULL DEFAULT '',
  postal_code     TEXT NOT NULL DEFAULT '',
  city            TEXT NOT NULL DEFAULT '',
  country         TEXT NOT NULL DEFAULT 'DE',
  terms_accepted_at TIMESTAMPTZ,
  avatar_url      TEXT NOT NULL DEFAULT '',
  role            TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  is_verified     BOOLEAN NOT NULL DEFAULT FALSE,
  verification_note TEXT NOT NULL DEFAULT '',
  suspended_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE listing (
  id              SERIAL PRIMARY KEY,
  seller_id       INTEGER NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  sport           TEXT NOT NULL,
  manufacturer    TEXT NOT NULL,
  set_name        TEXT NOT NULL DEFAULT '',
  year            INTEGER NOT NULL,
  player_name     TEXT NOT NULL,
  team            TEXT NOT NULL DEFAULT '',
  card_number     TEXT NOT NULL DEFAULT '',
  card_type       card_type NOT NULL,
  condition_grade TEXT NOT NULL,
  price_cents     INTEGER NOT NULL CHECK (price_cents >= 0),
  currency        TEXT NOT NULL DEFAULT 'EUR',
  description     TEXT NOT NULL DEFAULT '',
  image_urls      JSONB NOT NULL DEFAULT '[]'::jsonb,
  status          listing_status NOT NULL DEFAULT 'ACTIVE',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_listing_market ON listing (status, updated_at DESC);
CREATE INDEX idx_listing_seller ON listing (seller_id);

CREATE TABLE favorite (
  user_id    INTEGER NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  listing_id INTEGER NOT NULL REFERENCES listing (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, listing_id)
);

CREATE TABLE conversation (
  id               SERIAL PRIMARY KEY,
  listing_id       INTEGER NOT NULL REFERENCES listing (id) ON DELETE CASCADE,
  buyer_id         INTEGER NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  seller_id        INTEGER NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at  TIMESTAMPTZ,
  UNIQUE (listing_id, buyer_id)
);

CREATE INDEX idx_conversation_buyer ON conversation (buyer_id);
CREATE INDEX idx_conversation_seller ON conversation (seller_id);

CREATE TABLE message (
  id               SERIAL PRIMARY KEY,
  conversation_id  INTEGER NOT NULL REFERENCES conversation (id) ON DELETE CASCADE,
  sender_id        INTEGER NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  body             TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_message_conversation ON message (conversation_id, created_at);

CREATE TABLE review (
  id           SERIAL PRIMARY KEY,
  reviewer_id  INTEGER NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  seller_id    INTEGER NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  listing_id   INTEGER REFERENCES listing (id) ON DELETE SET NULL,
  rating       SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment      TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (reviewer_id, seller_id)
);

CREATE INDEX idx_review_seller ON review (seller_id);
