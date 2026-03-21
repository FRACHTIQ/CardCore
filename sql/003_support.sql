-- Support-Tickets & AGB-Zustimmung (nach vorherigen Migrationen ausführen)

ALTER TABLE app_user
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;

CREATE TYPE support_ticket_status AS ENUM (
  'OPEN',
  'WAITING_STAFF',
  'ANSWERED',
  'CLOSED'
);

CREATE TABLE support_ticket (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  subject         TEXT NOT NULL,
  status          support_ticket_status NOT NULL DEFAULT 'OPEN',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE support_message (
  id              SERIAL PRIMARY KEY,
  ticket_id       INTEGER NOT NULL REFERENCES support_ticket (id) ON DELETE CASCADE,
  from_user       BOOLEAN NOT NULL DEFAULT TRUE,
  body            TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_support_ticket_user ON support_ticket (user_id, updated_at DESC);
CREATE INDEX idx_support_message_ticket ON support_message (ticket_id, created_at);
