-- Partner-Link für App-Footer zentral konfigurierbar machen
ALTER TABLE app_config
  ADD COLUMN IF NOT EXISTS partner_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS partner_url TEXT NOT NULL DEFAULT '';
