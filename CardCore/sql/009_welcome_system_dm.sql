-- Willkommens-DM: Anker-Listing unter Account id = 1 (nicht im Markt: ARCHIVED)
-- Voraussetzung: app_user mit id = 1 existiert (z. B. Inhaber-Account).
-- In Railway PostgreSQL ausführen.

ALTER TABLE listing ADD COLUMN IF NOT EXISTS is_welcome_anchor BOOLEAN NOT NULL DEFAULT FALSE;

INSERT INTO listing (
  seller_id,
  sport,
  manufacturer,
  set_name,
  year,
  player_name,
  team,
  card_number,
  card_type,
  condition_grade,
  price_cents,
  currency,
  description,
  status,
  is_welcome_anchor
)
SELECT
  1,
  'Support',
  'VURAX',
  '',
  2025,
  'Willkommen',
  'VURAX',
  '',
  'BASE'::card_type,
  'nm',
  0,
  'EUR',
  'Internes Anker-Listing für Willkommensnachrichten.',
  'ARCHIVED'::listing_status,
  TRUE
WHERE EXISTS (SELECT 1 FROM app_user WHERE id = 1)
  AND NOT EXISTS (SELECT 1 FROM listing l WHERE l.is_welcome_anchor = TRUE);

CREATE UNIQUE INDEX IF NOT EXISTS idx_listing_one_welcome_anchor
  ON listing (is_welcome_anchor)
  WHERE is_welcome_anchor = TRUE;
