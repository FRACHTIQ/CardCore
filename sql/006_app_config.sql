-- Globale App-Konfiguration (ein Datensatz, id = 1)

CREATE TABLE IF NOT EXISTS app_config (
  id                    INTEGER PRIMARY KEY CHECK (id = 1),
  min_native_version    TEXT NOT NULL DEFAULT '1.0.0',
  maintenance_enabled   BOOLEAN NOT NULL DEFAULT FALSE,
  maintenance_message   TEXT NOT NULL DEFAULT '',
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO app_config (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;
