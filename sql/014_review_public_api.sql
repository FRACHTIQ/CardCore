-- Öffentliche Review-Liste (Profil-Snippets). Idempotent mit CardCore-kompatiblem Schema.
CREATE TABLE IF NOT EXISTS review (
  id           SERIAL PRIMARY KEY,
  reviewer_id  INTEGER NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  seller_id    INTEGER NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  listing_id   INTEGER REFERENCES listing (id) ON DELETE SET NULL,
  rating       SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment      TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tags         JSONB NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE (reviewer_id, seller_id)
);

CREATE INDEX IF NOT EXISTS idx_review_seller_created
  ON review (seller_id, created_at DESC);
