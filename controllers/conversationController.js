const { query, withTransaction } = require("../db");
const { HttpError } = require("../utils/httpError");
const { assertNotBlocked } = require("../services/userBlocking");

/** Wie Profilbild: Data-URL, Obergrenze gegen Missbrauch */
const MAX_MESSAGE_IMAGE_DATA_URL = 400000;

function parseMessagePayload(req) {
  const body = String(req.body.body ?? "").trim();
  const rawImg = req.body.image_url;
  const imageUrl =
    rawImg !== undefined && rawImg !== null && String(rawImg).trim() !== ""
      ? String(rawImg).trim().slice(0, MAX_MESSAGE_IMAGE_DATA_URL)
      : null;

  if (!imageUrl && body.length === 0) {
    throw new HttpError(400, "Nachricht darf nicht leer sein.");
  }
  if (body.length > 8000) {
    throw new HttpError(400, "Nachricht zu lang.");
  }
  if (imageUrl && !imageUrl.startsWith("data:image/")) {
    throw new HttpError(400, "Bild muss eine gültige Bild-Data-URL sein.");
  }
  return { body: body || "", image_url: imageUrl };
}

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

function otherParticipant(convRow, userId) {
  return convRow.buyer_id === userId ? convRow.seller_id : convRow.buyer_id;
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
         ou.display_name AS other_display_name,
         (SELECT m.sender_id FROM message m
            WHERE m.conversation_id = c.id
            ORDER BY m.created_at DESC LIMIT 1) AS last_message_sender_id,
         (SELECT CASE
            WHEN m.image_url IS NOT NULL AND LENGTH(TRIM(COALESCE(m.body, ''))) = 0 THEN '📷 Foto'
            ELSE LEFT(TRIM(COALESCE(m.body, '')), 140)
          END
          FROM message m
            WHERE m.conversation_id = c.id
            ORDER BY m.created_at DESC LIMIT 1) AS last_message_preview
       FROM conversation c
       JOIN listing l ON l.id = c.listing_id
       JOIN app_user ou ON ou.id = (
         CASE WHEN c.buyer_id = $1 THEN c.seller_id ELSE c.buyer_id END
       )
       WHERE (c.buyer_id = $1 OR c.seller_id = $1)
       AND NOT EXISTS (
         SELECT 1 FROM user_block ub
         WHERE (
           (ub.blocker_id = $1 AND ub.blocked_id = (CASE WHEN c.buyer_id = $1 THEN c.seller_id ELSE c.buyer_id END))
           OR (ub.blocker_id = (CASE WHEN c.buyer_id = $1 THEN c.seller_id ELSE c.buyer_id END) AND ub.blocked_id = $1)
         )
       )
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

    await assertNotBlocked(buyerId, sellerId);

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

    const convRow = await assertConversationMember(conversationId, req.userId);
    await assertNotBlocked(req.userId, otherParticipant(convRow, req.userId));

    const since = req.query.since ? String(req.query.since) : null;
    const limit = Math.min(
      200,
      Math.max(1, Number(req.query.limit) || 50)
    );

    let sqlParams;
    let sql;
    if (since) {
      sql = `
        SELECT id, conversation_id, sender_id, body, image_url, created_at
        FROM message
        WHERE conversation_id = $1 AND created_at > $2::timestamptz
        ORDER BY created_at ASC
        LIMIT $3
      `;
      sqlParams = [conversationId, since, limit];
    } else {
      sql = `
        SELECT id, conversation_id, sender_id, body, image_url, created_at
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

    const { body, image_url: imageUrl } = parseMessagePayload(req);

    const convRow = await assertConversationMember(conversationId, req.userId);
    await assertNotBlocked(req.userId, otherParticipant(convRow, req.userId));

    const inserted = await withTransaction(async (client) => {
      const msgRes = await client.query(
        `INSERT INTO message (conversation_id, sender_id, body, image_url)
         VALUES ($1, $2, $3, $4)
         RETURNING id, conversation_id, sender_id, body, image_url, created_at`,
        [conversationId, req.userId, body, imageUrl]
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

async function deleteMessage(req, res, next) {
  try {
    const conversationId = Number(req.params.id);
    const messageId = Number(req.params.messageId);
    if (!Number.isInteger(conversationId) || conversationId < 1) {
      throw new HttpError(400, "Ungültige Konversations-ID.");
    }
    if (!Number.isInteger(messageId) || messageId < 1) {
      throw new HttpError(400, "Ungültige Nachrichten-ID.");
    }

    const convRow = await assertConversationMember(conversationId, req.userId);
    await assertNotBlocked(req.userId, otherParticipant(convRow, req.userId));

    await withTransaction(async (client) => {
      const del = await client.query(
        `DELETE FROM message
         WHERE id = $1 AND conversation_id = $2 AND sender_id = $3
         RETURNING id`,
        [messageId, conversationId, req.userId]
      );
      if (!del.rows[0]) {
        throw new HttpError(404, "Nachricht nicht gefunden.");
      }
      await client.query(
        `UPDATE conversation
         SET last_message_at = (
           SELECT MAX(created_at) FROM message WHERE conversation_id = $1
         ),
         updated_at = NOW()
         WHERE id = $1`,
        [conversationId]
      );
    });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listMine,
  openOrCreate,
  getMessages,
  postMessage,
  deleteMessage,
};
