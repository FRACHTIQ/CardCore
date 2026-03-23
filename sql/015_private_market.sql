-- Private Market / Private Trade (V1)
-- Nach Ausführung: nur Nutzer mit private_market_access sehen private Listings (API-Filter).

ALTER TABLE app_user
  ADD COLUMN IF NOT EXISTS private_market_access BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE listing
  ADD COLUMN IF NOT EXISTS is_private_market BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_listing_private_active_updated
  ON listing (updated_at DESC)
  WHERE status = 'ACTIVE' AND is_private_market = TRUE;
