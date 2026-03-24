const { query } = require("../db");
const { HttpError } = require("../utils/httpError");

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

async function create(req, res, next) {
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
      throw new HttpError(400, "seller_id erforderlich.");
    }
    if (sellerId === req.userId) {
      throw new HttpError(400, "Eigenes Profil kann nicht bewertet werden.");
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new HttpError(400, "Bewertung 1–5 erforderlich.");
    }

    const seller = await query(`SELECT id FROM app_user WHERE id = $1`, [
      sellerId,
    ]);
    if (seller.rows.length === 0) {
      throw new HttpError(404, "Verkäufer nicht gefunden.");
    }

    if (listingId !== null && (!Number.isInteger(listingId) || listingId < 1)) {
      throw new HttpError(400, "Ungültige listing_id.");
    }

    const result = await query(
      `INSERT INTO review (reviewer_id, seller_id, listing_id, rating, comment, tags)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       ON CONFLICT (reviewer_id, seller_id)
       DO UPDATE SET
         rating = EXCLUDED.rating,
         comment = EXCLUDED.comment,
         tags = EXCLUDED.tags,
         listing_id = COALESCE(EXCLUDED.listing_id, review.listing_id)
       RETURNING id, reviewer_id, seller_id, listing_id, rating, comment, tags, created_at`,
      [req.userId, sellerId, listingId, rating, comment, JSON.stringify(tags)]
    );

    res.status(201).json({ review: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

/** Öffentlich: letzte Bewertungen eines Verkäufers (Profil-Snippets). */
async function listBySeller(req, res, next) {
  try {
    const sellerId = Number(req.params.sellerId);
    let limit = Number.parseInt(String(req.query.limit || "3"), 10);
    if (!Number.isFinite(limit) || limit < 1) limit = 3;
    if (limit > 10) limit = 10;

    if (!Number.isInteger(sellerId) || sellerId < 1) {
      throw new HttpError(400, "Ungültige sellerId.");
    }

    const exists = await query(`SELECT 1 FROM app_user WHERE id = $1`, [
      sellerId,
    ]);
    if (exists.rows.length === 0) {
      throw new HttpError(404, "Nutzer nicht gefunden.");
    }

    const result = await query(
      `SELECT r.rating, r.comment, r.created_at
       FROM review r
       WHERE r.seller_id = $1
       ORDER BY r.created_at DESC
       LIMIT $2`,
      [sellerId, limit]
    );

    res.json({ reviews: result.rows });
  } catch (err) {
    next(err);
  }
}

module.exports = { create, listBySeller };
