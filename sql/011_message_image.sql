-- Nachrichten: optionales Bild (Data-URL wie Profilbild), Text optional als Bildunterschrift.
ALTER TABLE message
  ADD COLUMN IF NOT EXISTS image_url TEXT;

ALTER TABLE message
  ALTER COLUMN body SET DEFAULT '';

UPDATE message SET body = '' WHERE body IS NULL;

ALTER TABLE message
  ALTER COLUMN body SET NOT NULL;

ALTER TABLE message DROP CONSTRAINT IF EXISTS message_body_or_image;

ALTER TABLE message
  ADD CONSTRAINT message_body_or_image CHECK (
    length(trim(body)) > 0
    OR (image_url IS NOT NULL AND length(trim(image_url)) > 0)
  );
