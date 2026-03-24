-- CardCore – nach 001_initial.sql ausführen (z. B. Railway PostgreSQL)
-- Handels-/Versanddaten pro Nutzer

ALTER TABLE app_user
  ADD COLUMN legal_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN phone TEXT NOT NULL DEFAULT '',
  ADD COLUMN street TEXT NOT NULL DEFAULT '',
  ADD COLUMN address_extra TEXT NOT NULL DEFAULT '',
  ADD COLUMN postal_code TEXT NOT NULL DEFAULT '',
  ADD COLUMN city TEXT NOT NULL DEFAULT '',
  ADD COLUMN country TEXT NOT NULL DEFAULT 'DE';
