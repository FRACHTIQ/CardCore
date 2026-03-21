const { query } = require("../db");
const { HttpError } = require("../utils/httpError");

async function listMine(req, res, next) {
  try {
    const r = await query(
      `SELECT * FROM trade_deal
       WHERE buyer_id = $1 OR seller_id = $1
       ORDER BY updated_at DESC`,
      [req.userId]
    );
    res.json({ deals: r.rows });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      throw new HttpError(400, "Ungültige ID.");
    }
    const r = await query(`SELECT * FROM trade_deal WHERE id = $1`, [id]);
    const deal = r.rows[0];
    if (!deal) {
      throw new HttpError(404, "Deal nicht gefunden.");
    }
    if (deal.buyer_id !== req.userId && deal.seller_id !== req.userId) {
      throw new HttpError(403, "Keine Berechtigung.");
    }
    res.json({ deal });
  } catch (err) {
    next(err);
  }
}

/**
 * Status: Verkäufer setzt SHIPPED + tracking_number (Pflicht).
 * Käufer setzt DELIVERED. Beide können auf COMPLETED nach Absprache.
 */
async function patchDeal(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      throw new HttpError(400, "Ungültige ID.");
    }

    const r = await query(`SELECT * FROM trade_deal WHERE id = $1`, [id]);
    const deal = r.rows[0];
    if (!deal) {
      throw new HttpError(404, "Deal nicht gefunden.");
    }
    const uid = req.userId;
    if (deal.buyer_id !== uid && deal.seller_id !== uid) {
      throw new HttpError(403, "Keine Berechtigung.");
    }

    const status = req.body.status
      ? String(req.body.status).toUpperCase()
      : null;
    const tracking = req.body.tracking_number
      ? String(req.body.tracking_number).trim().slice(0, 120)
      : null;

    if (!status || !["SHIPPED", "DELIVERED", "COMPLETED", "CANCELLED"].includes(status)) {
      throw new HttpError(400, "Ungültiger Status.");
    }

    if (status === "SHIPPED") {
      if (deal.seller_id !== uid) {
        throw new HttpError(403, "Nur der Verkäufer kann versenden.");
      }
      if (!tracking) {
        throw new HttpError(400, "Trackingnummer erforderlich.");
      }
      const upd = await query(
        `UPDATE trade_deal
         SET status = 'SHIPPED'::deal_status, tracking_number = $2, updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [id, tracking]
      );
      return res.json({ deal: upd.rows[0] });
    }

    if (status === "DELIVERED") {
      if (deal.buyer_id !== uid) {
        throw new HttpError(403, "Nur der Käufer kann Ware erhalten bestätigen.");
      }
      if (deal.status !== "SHIPPED") {
        throw new HttpError(400, "Erst Versand mit Tracking melden.");
      }
      const upd = await query(
        `UPDATE trade_deal SET status = 'DELIVERED'::deal_status, updated_at = NOW()
         WHERE id = $1 RETURNING *`,
        [id]
      );
      return res.json({ deal: upd.rows[0] });
    }

    if (status === "COMPLETED") {
      if (deal.status !== "DELIVERED") {
        throw new HttpError(400, "Zuerst als geliefert markieren.");
      }
      const upd = await query(
        `UPDATE trade_deal SET status = 'COMPLETED'::deal_status, updated_at = NOW()
         WHERE id = $1 RETURNING *`,
        [id]
      );
      return res.json({ deal: upd.rows[0] });
    }

    if (status === "CANCELLED") {
      if (!["AGREED", "SHIPPED"].includes(String(deal.status))) {
        throw new HttpError(400, "Deal kann so nicht storniert werden.");
      }
      const upd = await query(
        `UPDATE trade_deal SET status = 'CANCELLED'::deal_status, updated_at = NOW()
         WHERE id = $1 RETURNING *`,
        [id]
      );
      return res.json({ deal: upd.rows[0] });
    }

    throw new HttpError(400, "Ungültiger Vorgang.");
  } catch (err) {
    next(err);
  }
}

module.exports = { listMine, getById, patchDeal };
