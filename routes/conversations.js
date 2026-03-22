const express = require("express");
const { pool, withTransaction } = require("../db");
const { authRequired } = require("../middleware/auth");
const { HttpError } = require("../utils/httpError");
const { isPairBlocked } = require("../utils/blocking");
const { recordSellerResponseHours } = require("../services/responseMetrics");
const { fireAndNotifyNewMessage } = require("../services/expoPush");

const router = express.Router();
router.use(authRequired);

/** GET /api/conversations */
router.get("/", async (req, res, next) => {
  try {
    const uid = req.userId;
    const limit = Math.min(
      Math.max(Number.parseInt(String(req.query.limit || "40"), 10) || 40, 1),
      100
    );
    const r = await pool.query(
      `SELECT c.*, l.player_name AS listing_player_name, l.status AS listing_status,
              l.price_cents, l.currency, l.id AS listing_id
       FROM conversation c
       JOIN listing l ON l.id = c.listing_id
       WHERE c.buyer_id = $1 OR c.seller_id = $1
       ORDER BY COALESCE(c.last_message_at, c.updated_at) DESC NULLS LAST
       LIMIT $2`,
      [uid, limit]
    );
    res.json({ conversations: r.rows });
  } catch (err) {
    next(err);
  }
});

/** POST /api/conversations — { listing_id } */
router.post("/", async (req, res, next) => {
  try {
    const listingId = Number(req.body.listing_id);
    if (!Number.isInteger(listingId) || listingId < 1) {
      throw new HttpError(400, "listing_id erforderlich.");
    }

    const lr = await pool.query(`SELECT * FROM listing WHERE id = $1`, [
      listingId,
    ]);
    const listing = lr.rows[0];
    if (!listing) {
      throw new HttpError(404, "Inserat nicht gefunden.");
    }
    const sellerId = Number(listing.seller_id);
    const buyerId = Number(req.userId);
    if (sellerId === buyerId) {
      throw new HttpError(400, "Eigenes Inserat.");
    }
    if (await isPairBlocked(buyerId, sellerId)) {
      throw new HttpError(403, "Kontakt nicht möglich.");
    }

    const ins = await pool.query(
      `INSERT INTO conversation (listing_id, buyer_id, seller_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (listing_id, buyer_id) DO UPDATE SET updated_at = NOW()
       RETURNING *`,
      [listingId, buyerId, sellerId]
    );
    res.status(201).json({ conversation: ins.rows[0] });
  } catch (err) {
    next(err);
  }
});

const msgRouter = express.Router({ mergeParams: true });
msgRouter.use(authRequired);

/** GET /api/conversations/:conversationId/messages */
msgRouter.get("/", async (req, res, next) => {
  try {
    const conversationId = Number(req.params.conversationId);
    const limit = Math.min(
      Math.max(Number.parseInt(String(req.query.limit || "50"), 10) || 50, 1),
      200
    );
    const beforeId = req.query.before_id
      ? Number(req.query.before_id)
      : null;

    if (!Number.isInteger(conversationId) || conversationId < 1) {
      throw new HttpError(400, "Ungültige Konversations-ID.");
    }

    const part = await pool.query(
      `SELECT id, buyer_id, seller_id FROM conversation WHERE id = $1`,
      [conversationId]
    );
    const c = part.rows[0];
    if (!c) {
      throw new HttpError(404, "Konversation nicht gefunden.");
    }
    const uid = Number(req.userId);
    if (Number(c.buyer_id) !== uid && Number(c.seller_id) !== uid) {
      throw new HttpError(403, "Kein Zugriff.");
    }

    let sql;
    let params;
    if (beforeId && Number.isInteger(beforeId) && beforeId > 0) {
      sql = `SELECT * FROM message
             WHERE conversation_id = $1 AND id < $2
             ORDER BY created_at DESC, id DESC
             LIMIT $3`;
      params = [conversationId, beforeId, limit];
    } else {
      sql = `SELECT * FROM message
             WHERE conversation_id = $1
             ORDER BY created_at DESC, id DESC
             LIMIT $2`;
      params = [conversationId, limit];
    }
    const r = await pool.query(sql, params);
    const messages = r.rows.reverse();
    res.json({ messages });
  } catch (err) {
    next(err);
  }
});

/** POST /api/conversations/:conversationId/messages */
msgRouter.post("/", async (req, res, next) => {
  try {
    const conversationId = Number(req.params.conversationId);
    if (!Number.isInteger(conversationId) || conversationId < 1) {
      throw new HttpError(400, "Ungültige Konversations-ID.");
    }

    const body = String(req.body.body ?? "").trim();
    const imageUrl = req.body.image_url
      ? String(req.body.image_url).trim().slice(0, 500_000)
      : "";

    if (body.length === 0 && imageUrl.length === 0) {
      throw new HttpError(400, "Nachrichtentext oder Bild erforderlich.");
    }

    const outcome = await withTransaction(async (client) => {
      const part = await client.query(
        `SELECT id, buyer_id, seller_id FROM conversation WHERE id = $1 FOR UPDATE`,
        [conversationId]
      );
      const c = part.rows[0];
      if (!c) {
        throw new HttpError(404, "Konversation nicht gefunden.");
      }
      const uid = Number(req.userId);
      const buyerId = Number(c.buyer_id);
      const sellerId = Number(c.seller_id);
      if (buyerId !== uid && sellerId !== uid) {
        throw new HttpError(403, "Kein Zugriff.");
      }
      if (await isPairBlocked(buyerId, sellerId)) {
        throw new HttpError(403, "Kontakt nicht möglich.");
      }

      const ins = await client.query(
        `INSERT INTO message (conversation_id, sender_id, body, image_url)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [conversationId, uid, body, imageUrl || null]
      );
      const message = ins.rows[0];

      await client.query(
        `UPDATE conversation SET last_message_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [conversationId]
      );

      await recordSellerResponseHours(client, {
        conversationId,
        newMessageId: message.id,
      });

      return { message, c };
    });

    const recipient =
      Number(outcome.c.buyer_id) === Number(req.userId)
        ? outcome.c.seller_id
        : outcome.c.buyer_id;
    const preview =
      outcome.message.body?.slice(0, 120) ||
      (outcome.message.image_url ? "📷 Bild" : "");
    fireAndNotifyNewMessage({
      recipientUserId: recipient,
      title: "Neue Nachricht",
      body: preview,
      data: {
        type: "message",
        conversation_id: outcome.c.id,
      },
    });

    res.status(201).json({ message: outcome.message });
  } catch (err) {
    next(err);
  }
});

router.use("/:conversationId/messages", msgRouter);

module.exports = router;
