const express = require("express");
const { pool } = require("../db");
const { authRequired } = require("../middleware/auth");

const router = express.Router();

const TAG_WHITELIST = new Set([
  "shipping_fast",
  "communication_good",
  "late_delivery",
]);

function normalizeTags(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out = [];
  for (const x of raw) {
    const k = String(x || "").trim();
    if (TAG_WHITELIST.has(k) && !out.includes(k)) {
      out.push(k);
    }
    if (out.length >= 5) {
      break;
    }
  }
  return out;
}

/**
 * GET /api/reviews/seller/:sellerId
 * Öffentlich: letzte Bewertungen eines Verkäufers (Kurz-Snippets für Profil).
 * Query: limit (1–10, Standard 3)
 */
router.get("/seller/:sellerId", async (req, res) => {
  const sellerId = Number(req.params.sellerId);
  let limit = Number.parseInt(String(req.query.limit || "3"), 10);
  if (!Number.isFinite(limit) || limit < 1) limit = 3;
  if (limit > 10) limit = 10;

  if (!Number.isInteger(sellerId) || sellerId < 1) {
    return res.status(400).json({ error: "Ungültige sellerId." });
  }

  try {
    const exists = await pool.query(
      `SELECT 1 FROM app_user WHERE id = $1`,
      [sellerId]
    );
    if (exists.rows.length === 0) {
      return res.status(404).json({ error: "Nutzer nicht gefunden." });
    }

    const result = await pool.query(
      `SELECT r.rating, r.comment, r.created_at
       FROM review r
       WHERE r.seller_id = $1
       ORDER BY r.created_at DESC
       LIMIT $2`,
      [sellerId, limit]
    );

    return res.json({ reviews: result.rows });
  } catch (err) {
    console.error("[reviews] listBySeller:", err);
    return res.status(500).json({ error: "Serverfehler." });
  }
});

/** POST /api/reviews — Bewertung abgeben (auth) */
router.post("/", authRequired, async (req, res) => {
  try {
    const sellerId = Number(req.body.seller_id);
    const rating = Number(req.body.rating);
    const comment = String(req.body.comment || "");
    const tags = normalizeTags(req.body.tags);
    const listingId =
      req.body.listing_id !== undefined && req.body.listing_id !== null
        ? Number(req.body.listing_id)
        : null;

    if (!Number.isInteger(sellerId) || sellerId < 1) {
      return res.status(400).json({ error: "seller_id erforderlich." });
    }
    if (sellerId === req.userId) {
      return res.status(400).json({ error: "Eigenes Profil kann nicht bewertet werden." });
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Bewertung 1–5 erforderlich." });
    }

    const seller = await pool.query(`SELECT id FROM app_user WHERE id = $1`, [
      sellerId,
    ]);
    if (seller.rows.length === 0) {
      return res.status(404).json({ error: "Verkäufer nicht gefunden." });
    }

    if (listingId !== null && (!Number.isInteger(listingId) || listingId < 1)) {
      return res.status(400).json({ error: "Ungültige listing_id." });
    }

    const result = await pool.query(
      `INSERT INTO review (reviewer_id, seller_id, listing_id, rating, comment, tags)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       ON CONFLICT (reviewer_id, seller_id)
       DO UPDATE SET
         rating = EXCLUDED.rating,
         comment = EXCLUDED.comment,
         tags = EXCLUDED.tags,
         listing_id = COALESCE(EXCLUDED.listing_id, review.listing_id)
       RETURNING id, reviewer_id, seller_id, listing_id, rating, comment, tags, created_at`,
      [
        req.userId,
        sellerId,
        listingId,
        rating,
        comment,
        JSON.stringify(tags),
      ]
    );

    return res.status(201).json({ review: result.rows[0] });
  } catch (err) {
    console.error("[reviews] create:", err);
    return res.status(500).json({ error: "Serverfehler." });
  }
});

module.exports = router;
