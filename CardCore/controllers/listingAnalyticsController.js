const { query } = require("../db");
const { HttpError } = require("../utils/httpError");

const RANGES = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

/**
 * Preisverlauf aus listing_price_history (eingeloggt).
 */
async function getListingAnalytics(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      throw new HttpError(400, "Ungültige ID.");
    }

    const rangeKey = String(req.query.range || "30d").toLowerCase();
    const days = RANGES[rangeKey] || 30;

    const access = await query(
      `SELECT l.id, l.seller_id, l.status FROM listing l WHERE l.id = $1`,
      [id]
    );
    const listing = access.rows[0];
    if (!listing) {
      throw new HttpError(404, "Listing nicht gefunden.");
    }
    const viewer = req.userId;
    const isOwner = viewer && viewer === listing.seller_id;
    if (listing.status !== "ACTIVE" && !isOwner) {
      throw new HttpError(404, "Listing nicht gefunden.");
    }

    const hist = await query(
      `SELECT price_cents, recorded_at
       FROM listing_price_history
       WHERE listing_id = $1
         AND recorded_at >= NOW() - ($2::int * INTERVAL '1 day')
       ORDER BY recorded_at ASC`,
      [id, days]
    );

    res.json({
      range: rangeKey,
      points: hist.rows.map((r) => ({
        t: r.recorded_at,
        price_cents: r.price_cents,
      })),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getListingAnalytics };
