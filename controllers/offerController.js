const { query, withTransaction } = require("../db");
const { HttpError } = require("../utils/httpError");

async function create(req, res, next) {
  try {
    const listingId = Number(req.body.listing_id);
    const priceCents = Number(req.body.price_cents);
    const message = String(req.body.message || "").trim().slice(0, 500);

    if (!Number.isInteger(listingId) || listingId < 1) {
      throw new HttpError(400, "listing_id erforderlich.");
    }
    if (!Number.isInteger(priceCents) || priceCents < 0) {
      throw new HttpError(400, "Ungültiger Preis.");
    }

    const lr = await query(
      `SELECT id, seller_id, status FROM listing WHERE id = $1`,
      [listingId]
    );
    const listing = lr.rows[0];
    if (!listing || listing.status !== "ACTIVE") {
      throw new HttpError(404, "Listing nicht verfügbar.");
    }
    if (listing.seller_id === req.userId) {
      throw new HttpError(400, "Eigenes Listing.");
    }

    const sellerId = listing.seller_id;
    const buyerId = req.userId;

    const dup = await query(
      `SELECT id FROM listing_offer
       WHERE listing_id = $1 AND buyer_id = $2 AND status = 'PENDING'`,
      [listingId, buyerId]
    );
    if (dup.rows.length > 0) {
      throw new HttpError(400, "Du hast bereits ein offenes Angebot für dieses Listing.");
    }

    const ins = await query(
      `INSERT INTO listing_offer (
         listing_id, buyer_id, seller_id, price_cents, message
       ) VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [listingId, buyerId, sellerId, priceCents, message]
    );

    res.status(201).json({ offer: ins.rows[0] });
  } catch (err) {
    next(err);
  }
}

async function listMine(req, res, next) {
  try {
    const role = String(req.query.role || "all").toLowerCase();
    let sql;
    const uid = req.userId;
    if (role === "buyer") {
      sql = `SELECT * FROM listing_offer WHERE buyer_id = $1 ORDER BY updated_at DESC`;
    } else if (role === "seller") {
      sql = `SELECT * FROM listing_offer WHERE seller_id = $1 ORDER BY updated_at DESC`;
    } else {
      sql = `SELECT * FROM listing_offer WHERE buyer_id = $1 OR seller_id = $1 ORDER BY updated_at DESC`;
    }
    const r = await query(sql, [uid]);
    res.json({ offers: r.rows });
  } catch (err) {
    next(err);
  }
}

async function reject(req, res, next) {
  try {
    const offerId = Number(req.params.id);
    if (!Number.isInteger(offerId) || offerId < 1) {
      throw new HttpError(400, "Ungültige ID.");
    }

    const o = await query(`SELECT * FROM listing_offer WHERE id = $1`, [offerId]);
    const offer = o.rows[0];
    if (!offer) {
      throw new HttpError(404, "Angebot nicht gefunden.");
    }
    if (offer.buyer_id !== req.userId && offer.seller_id !== req.userId) {
      throw new HttpError(403, "Keine Berechtigung.");
    }
    if (offer.status !== "PENDING") {
      throw new HttpError(400, "Angebot ist nicht mehr offen.");
    }

    const upd = await query(
      `UPDATE listing_offer SET status = 'REJECTED', updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [offerId]
    );
    res.json({ offer: upd.rows[0] });
  } catch (err) {
    next(err);
  }
}

async function accept(req, res, next) {
  try {
    const offerId = Number(req.params.id);
    if (!Number.isInteger(offerId) || offerId < 1) {
      throw new HttpError(400, "Ungültige ID.");
    }

    const deal = await withTransaction(async (client) => {
      const o = await client.query(
        `SELECT * FROM listing_offer WHERE id = $1 FOR UPDATE`,
        [offerId]
      );
      const offer = o.rows[0];
      if (!offer) {
        throw new HttpError(404, "Angebot nicht gefunden.");
      }
      if (offer.seller_id !== req.userId) {
        throw new HttpError(403, "Nur der Verkäufer kann annehmen.");
      }
      if (offer.status !== "PENDING") {
        throw new HttpError(400, "Angebot ist nicht offen.");
      }

      await client.query(
        `UPDATE listing_offer SET status = 'REJECTED', updated_at = NOW()
         WHERE listing_id = $1 AND status = 'PENDING' AND id <> $2`,
        [offer.listing_id, offerId]
      );
      await client.query(
        `UPDATE listing_offer SET status = 'ACCEPTED', updated_at = NOW() WHERE id = $1`,
        [offerId]
      );
      await client.query(
        `UPDATE listing SET status = 'SOLD', updated_at = NOW() WHERE id = $1`,
        [offer.listing_id]
      );
      const dealIns = await client.query(
        `INSERT INTO trade_deal (
           listing_id, buyer_id, seller_id, offer_id, agreed_price_cents, currency, status
         ) VALUES ($1, $2, $3, $4, $5, $6, 'AGREED')
         RETURNING *`,
        [
          offer.listing_id,
          offer.buyer_id,
          offer.seller_id,
          offerId,
          offer.price_cents,
          offer.currency || "EUR",
        ]
      );
      return dealIns.rows[0];
    });

    res.json({ deal, ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { create, listMine, reject, accept };
