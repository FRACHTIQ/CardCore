const { query } = require("../db");
const { HttpError } = require("../utils/httpError");

async function listMine(req, res, next) {
  try {
    const result = await query(
      `SELECT
         f.created_at AS favorited_at,
         l.id,
         l.seller_id,
         l.sport,
         l.manufacturer,
         l.set_name,
         l.year,
         l.player_name,
         l.team,
         l.card_number,
         l.card_type,
         l.condition_grade,
         l.price_cents,
         l.currency,
         l.description,
         l.image_urls,
         l.status,
         l.created_at,
         l.updated_at,
         u.display_name AS seller_display_name
       FROM favorite f
       JOIN listing l ON l.id = f.listing_id
       JOIN app_user u ON u.id = l.seller_id
       WHERE f.user_id = $1 AND l.status = 'ACTIVE'
       ORDER BY f.created_at DESC`,
      [req.userId]
    );
    res.json({ favorites: result.rows });
  } catch (err) {
    next(err);
  }
}

async function add(req, res, next) {
  try {
    const listingId = Number(req.params.listingId);
    if (!Number.isInteger(listingId) || listingId < 1) {
      throw new HttpError(400, "Ungültige Listing-ID.");
    }

    const check = await query(
      `SELECT id, seller_id, status FROM listing WHERE id = $1`,
      [listingId]
    );
    const listing = check.rows[0];
    if (!listing || listing.status !== "ACTIVE") {
      throw new HttpError(404, "Listing nicht verfügbar.");
    }
    if (listing.seller_id === req.userId) {
      throw new HttpError(400, "Eigenes Listing kann nicht favorisiert werden.");
    }

    await query(
      `INSERT INTO favorite (user_id, listing_id) VALUES ($1, $2)
       ON CONFLICT (user_id, listing_id) DO NOTHING`,
      [req.userId, listingId]
    );

    res.status(204).send();
  } catch (err) {
    if (err.code === "23503") {
      next(new HttpError(404, "Listing nicht gefunden."));
      return;
    }
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const listingId = Number(req.params.listingId);
    if (!Number.isInteger(listingId) || listingId < 1) {
      throw new HttpError(400, "Ungültige Listing-ID.");
    }

    const result = await query(
      `DELETE FROM favorite WHERE user_id = $1 AND listing_id = $2`,
      [req.userId, listingId]
    );
    if (result.rowCount === 0) {
      throw new HttpError(404, "Favorit nicht gefunden.");
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { listMine, add, remove };
