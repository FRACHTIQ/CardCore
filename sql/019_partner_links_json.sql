-- Mehrere Partnerlinks für App-Footer (als JSON-Liste)
ALTER TABLE app_config
  ADD COLUMN IF NOT EXISTS partner_links_json TEXT NOT NULL DEFAULT '[]';
