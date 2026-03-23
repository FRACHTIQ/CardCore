-- Private Trade: Einladungscodes (invite-only)

CREATE TABLE private_market_invite (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL,
  max_redemptions INTEGER,
  redemption_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  note TEXT NOT NULL DEFAULT '',
  created_by_admin_id INTEGER REFERENCES app_user (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  CONSTRAINT private_market_invite_code_upper_ck CHECK (code = upper(code)),
  CONSTRAINT uq_private_market_invite_code UNIQUE (code)
);

CREATE TABLE private_market_invite_redemption (
  id SERIAL PRIMARY KEY,
  invite_id INTEGER NOT NULL REFERENCES private_market_invite (id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_private_market_invite_redemption_user UNIQUE (user_id)
);

CREATE INDEX idx_private_market_invite_redemption_invite
  ON private_market_invite_redemption (invite_id);
