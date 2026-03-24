-- Blockierung zwischen Nutzern (kein Chat / keine Profilansicht für blockierte Seite)
CREATE TABLE IF NOT EXISTS user_block (
  blocker_id INTEGER NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  blocked_id INTEGER NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_user_block_blocked ON user_block (blocked_id);

-- Meldungen (Moderation; Auswertung z. B. im Admin-Bereich)
CREATE TABLE IF NOT EXISTS user_report (
  id BIGSERIAL PRIMARY KEY,
  reporter_id INTEGER NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  reported_id INTEGER NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'open',
  CHECK (reporter_id <> reported_id),
  CHECK (length(trim(reason)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_user_report_reported ON user_report (reported_id);
CREATE INDEX IF NOT EXISTS idx_user_report_created ON user_report (created_at DESC);
