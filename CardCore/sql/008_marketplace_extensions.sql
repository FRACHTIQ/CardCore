-- Erweiterungen: Grading, Versand, Marktwert, Reviews-Tags, Preishistorie, Offers, Deals
-- In Railway PostgreSQL ausführen.

ALTER TABLE listing ADD COLUMN IF NOT EXISTS is_graded BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE listing ADD COLUMN IF NOT EXISTS grading_company TEXT NOT NULL DEFAULT '';
ALTER TABLE listing ADD COLUMN IF NOT EXISTS grading_grade TEXT NOT NULL DEFAULT '';
ALTER TABLE listing ADD COLUMN IF NOT EXISTS shipping_included BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE listing ADD COLUMN IF NOT EXISTS shipping_cost_cents INTEGER;
ALTER TABLE listing ADD COLUMN IF NOT EXISTS market_value_cents INTEGER;
ALTER TABLE listing ADD COLUMN IF NOT EXISTS market_value_source TEXT NOT NULL DEFAULT '';

ALTER TABLE review ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS listing_price_history (
  id BIGSERIAL PRIMARY KEY,
  listing_id INTEGER NOT NULL REFERENCES listing (id) ON DELETE CASCADE,
  price_cents INTEGER NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lph_listing_time ON listing_price_history (listing_id, recorded_at DESC);

DO $$ BEGIN
  CREATE TYPE offer_status AS ENUM (
    'PENDING', 'ACCEPTED', 'REJECTED', 'COUNTERED', 'WITHDRAWN'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS listing_offer (
  id SERIAL PRIMARY KEY,
  listing_id INTEGER NOT NULL REFERENCES listing (id) ON DELETE CASCADE,
  buyer_id INTEGER NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  seller_id INTEGER NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'EUR',
  status offer_status NOT NULL DEFAULT 'PENDING',
  counter_of_id INTEGER REFERENCES listing_offer (id),
  message TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lo_listing ON listing_offer (listing_id);
CREATE INDEX IF NOT EXISTS idx_lo_buyer ON listing_offer (buyer_id);
CREATE INDEX IF NOT EXISTS idx_lo_seller ON listing_offer (seller_id);

DO $$ BEGIN
  CREATE TYPE deal_status AS ENUM (
    'AGREED', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS trade_deal (
  id SERIAL PRIMARY KEY,
  listing_id INTEGER NOT NULL REFERENCES listing (id) ON DELETE CASCADE,
  buyer_id INTEGER NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  seller_id INTEGER NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  offer_id INTEGER REFERENCES listing_offer (id),
  agreed_price_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  status deal_status NOT NULL DEFAULT 'AGREED',
  tracking_number TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_td_listing ON trade_deal (listing_id);
CREATE INDEX IF NOT EXISTS idx_td_buyer ON trade_deal (buyer_id);
CREATE INDEX IF NOT EXISTS idx_td_seller ON trade_deal (seller_id);
