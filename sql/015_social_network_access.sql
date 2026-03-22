-- Social-Links nur für Admins oder explizit freigeschaltete Nutzer (Bearbeitung + sichtbare Links in /me).
ALTER TABLE app_user
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE app_user
  ADD COLUMN IF NOT EXISTS social_network_enabled BOOLEAN NOT NULL DEFAULT FALSE;
