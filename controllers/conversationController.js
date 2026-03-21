const { query, withTransaction } = require("../db");
const { HttpError } = require("../utils/httpError");

async function assertConversationMember(conversationId, userId) {
  const result = await query(
    `SELECT id, listing_id, buyer_id, seller_id FROM conversation WHERE id = $1`,
    [conversationId]
  );
  const row = result.rows[0];
  if (!row) {
    throw new HttpError(404, "Konversation nicht gefunden.");
  }
  if (row.buyer_id !== userId && row.seller_id !== userId) {
    throw new HttpError(403, "Keine Berechtigung.");
  }
  return row;
}

async function listMine(req, res, next) {
  try {
    const uid = req.userId;
    const result = await query(
      `SELECT
         c.id,
         c.listing_id,
         c.buyer_id,
         c.seller_id,
         c.created_at,
         c.updated_at,
         c.last_message_at,
         l.player_name AS listing_player_name,
         l.sport AS listing_sport,
         l.price_cents AS listing_price_cents,
         l.currency AS listing_currency,
         l.status AS listing_status,
         CASE WHEN c.buyer_id = $1 THEN c.seller_id ELSE c.buyer_id END AS other_user_id,
         ou.display_name AS other_display_name
       FROM conversation c
       JOIN listing l ON l.id = c.listing_id
       JOIN app_user ou ON ou.id = (
         CASE WHEN c.buyer_id = $1 THEN c.seller_id ELSE c.buyer_id END
       )
       WHERE c.buyer_id = $1 OR c.seller_id = $1
       ORDER BY COALESCE(c.last_message_at, c.updated_at) DESC`,
      [uid]
    );
    res.json({ conversations: result.rows });
  } catch (err) {
    next(err);
  }
}

async function openOrCreate(req, res, next) {
  try {
    const listingId = Number(req.body.listing_id);
    if (!Number.isInteger(listingId) || listingId < 1) {
      throw new HttpError(400, "listing_id erforderlich.");
    }

    const lr = await query(
      `SELECT id, seller_id, status FROM listing WHERE id = $1`,
      [listingId]
    );
    const listing = lr.rows[0];
    if (!listing || listing.status !== "ACTIVE") {
      throw new HttpError(404, "Listing nicht verfügbar.");
    }

    const buyerId = req.userId;
    const sellerId = listing.seller_id;
    if (buyerId === sellerId) {
      throw new HttpError(400, "Zu eigenem Listing kann keine Konversation gestartet werden.");
    }

    const result = await query(
      `INSERT INTO conversation (listing_id, buyer_id, seller_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (listing_id, buyer_id)
       DO UPDATE SET updated_at = NOW()
       RETURNING *`,
      [listingId, buyerId, sellerId]
    );

    res.status(200).json({ conversation: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

async function getMessages(req, res, next) {
  try {
    const conversationId = Number(req.params.id);
    if (!Number.isInteger(conversationId) || conversationId < 1) {
      throw new HttpError(400, "Ungültige ID.");
    }

    await assertConversationMember(conversationId, req.userId);

    const since = req.query.since ? String(req.query.since) : null;
    const limit = Math.min(
      200,
      Math.max(1, Number(req.query.limit) || 50)
    );

    let sqlParams;
    let sql;
    if (since) {
      sql = `
        SELECT id, conversation_id, sender_id, body, created_at
        FROM message
        WHERE conversation_id = $1 AND created_at > $2::timestamptz
        ORDER BY created_at ASC
        LIMIT $3
      `;
      sqlParams = [conversationId, since, limit];
    } else {
      sql = `
        SELECT id, conversation_id, sender_id, body, created_at
        FROM message
        WHERE conversation_id = $1
        ORDER BY created_at DESC
        LIMIT $2
      `;
      sqlParams = [conversationId, limit];
    }

    const result = await query(sql, sqlParams);
    const rows = [...result.rows].reverse();
    res.json({ messages: rows });
  } catch (err) {
    next(err);
  }
}

async function postMessage(req, res, next) {
  try {
    const conversationId = Number(req.params.id);
    if (!Number.isInteger(conversationId) || conversationId < 1) {
      throw new HttpError(400, "Ungültige ID.");
    }

    const body = String(req.body.body || "").trim();
    if (!body) {
      throw new HttpError(400, "Nachricht darf nicht leer sein.");
    }
    if (body.length > 8000) {
      throw new HttpError(400, "Nachricht zu lang.");
    }

    await assertConversationMember(conversationId, req.userId);

    const inserted = await withTransaction(async (client) => {
      const msgRes = await client.query(
        `INSERT INTO message (conversation_id, sender_id, body)
         VALUES ($1, $2, $3)
         RETURNING id, conversation_id, sender_id, body, created_at`,
        [conversationId, req.userId, body]
      );
      await client.query(
        `UPDATE conversation
         SET last_message_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [conversationId]
      );
      return msgRes.rows[0];
    });

    res.status(201).json({ message: inserted });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listMine,
  openOrCreate,
  getMessages,
  postMessage,
};
