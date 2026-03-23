-- Private Market: Zugangs-Flag Nutzer + private Listings (nur für Berechtigte sichtbar).

ALTER TABLE app_user
  ADD COLUMN IF NOT EXISTS private_market_access BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE listing
  ADD COLUMN IF NOT EXISTS is_private_market BOOLEAN NOT NULL DEFAULT FALSE;

-- Häufige Profil-Spalten (falls noch nicht vorhanden) — für /api/users/me kompatibel zur App
ALTER TABLE app_user
  ADD COLUMN IF NOT EXISTS display_name TEXT NOT NULL DEFAULT '';

ALTER TABLE app_user
  ADD COLUMN IF NOT EXISTS bio TEXT NOT NULL DEFAULT '';

ALTER TABLE app_user
  ADD COLUMN IF NOT EXISTS avatar_url TEXT NOT NULL DEFAULT '';

ALTER TABLE app_user
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE app_user
  ADD COLUMN IF NOT EXISTS legal_name TEXT NOT NULL DEFAULT '';

ALTER TABLE app_user
  ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT '';

ALTER TABLE app_user
  ADD COLUMN IF NOT EXISTS street TEXT NOT NULL DEFAULT '';

ALTER TABLE app_user
  ADD COLUMN IF NOT EXISTS address_extra TEXT NOT NULL DEFAULT '';

ALTER TABLE app_user
  ADD COLUMN IF NOT EXISTS postal_code TEXT NOT NULL DEFAULT '';

ALTER TABLE app_user
  ADD COLUMN IF NOT EXISTS city TEXT NOT NULL DEFAULT '';

ALTER TABLE app_user
  ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_listing_private_active_created
  ON listing (created_at DESC)
  WHERE status = 'ACTIVE'::listing_status AND COALESCE(is_private_market, FALSE) = TRUE;
