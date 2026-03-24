-- Profilbild (Data-URL, z. B. data:image/jpeg;base64,…)

ALTER TABLE app_user
  ADD COLUMN IF NOT EXISTS avatar_url TEXT NOT NULL DEFAULT '';
