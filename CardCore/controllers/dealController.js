const { query } = require("../db");

const { HttpError } = require("../utils/httpError");

const { fireNotifyUserIds, formatEur } = require("../services/expoPush");



function parsePagination(req) {

  const rawL = Number(req.query.limit);

  const rawO = Number(req.query.offset);

  const limit = Math.min(

    50,

    Math.max(1, Number.isFinite(rawL) && rawL > 0 ? Math.floor(rawL) : 30)

  );

  const offset = Math.max(

    0,

    Number.isFinite(rawO) && rawO >= 0 ? Math.floor(rawO) : 0

  );

  return { limit, offset };

}



async function listMine(req, res, next) {

  try {

    const uid = req.userId;

    const { limit, offset } = parsePagination(req);

    const statusFilter = req.query.status

      ? String(req.query.status).toUpperCase().trim()

      : null;

    const allowed = new Set([

      "AGREED",

      "SHIPPED",

      "DELIVERED",

      "COMPLETED",

      "CANCELLED",

    ]);



    let statusClause = "";

    const params = [uid];

    if (statusFilter && allowed.has(statusFilter)) {

      params.push(statusFilter);

      statusClause = ` AND d.status = $${params.length}::deal_status`;

    }



    params.push(limit, offset);

    const limIdx = params.length - 1;

    const offIdx = params.length;



    const r = await query(

      `SELECT d.*,

        l.player_name AS listing_player_name,

        l.image_urls AS listing_image_urls,

        l.currency AS listing_currency

       FROM trade_deal d

       JOIN listing l ON l.id = d.listing_id

       WHERE (d.buyer_id = $1 OR d.seller_id = $1)${statusClause}

       ORDER BY d.updated_at DESC

       LIMIT $${limIdx} OFFSET $${offIdx}`,

      params

    );

    res.json({ deals: r.rows, limit, offset });

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

    const r = await query(

      `SELECT d.*,

        l.player_name AS listing_player_name,

        l.image_urls AS listing_image_urls,

        l.currency AS listing_currency

       FROM trade_deal d

       JOIN listing l ON l.id = d.listing_id

       WHERE d.id = $1`,

      [id]

    );

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



    if (

      !status ||

      !["SHIPPED", "DELIVERED", "COMPLETED", "CANCELLED"].includes(status)

    ) {

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

      const row = upd.rows[0];

      const lr = await query(`SELECT player_name FROM listing WHERE id = $1`, [

        row.listing_id,

      ]);

      const playerName = lr.rows[0]?.player_name || "Karte";

      fireNotifyUserIds([row.buyer_id], {

        title: "VUREX · Versand unterwegs",

        body: `${playerName} · Tracking: ${tracking} · € ${formatEur(row.agreed_price_cents)}`,

        data: {

          type: "deal_shipped",

          deal_id: row.id,

          listing_id: row.listing_id,

        },

      });

      return res.json({ deal: row });

    }



    if (status === "DELIVERED") {

      if (deal.buyer_id !== uid) {

        throw new HttpError(

          403,

          "Nur der Käufer kann Ware erhalten bestätigen."

        );

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


