-- Antwortzeit-Metrik für Verkäufer (Rollierender Mittelwert in Stunden)
ALTER TABLE app_user
  ADD COLUMN IF NOT EXISTS avg_response_hours NUMERIC(10, 2);

ALTER TABLE app_user
  ADD COLUMN IF NOT EXISTS response_metric_samples INTEGER NOT NULL DEFAULT 0;
