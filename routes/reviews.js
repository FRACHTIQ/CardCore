const express = require("express");
const { pool } = require("../db");

const router = express.Router();

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

module.exports = router;
