const { withTransaction } = require("../db");

/** Absender der Willkommensnachricht (Inhaber-Account). */
const WELCOME_SENDER_USER_ID = 1;

/** Einheitlicher Text für die automatische erste Nachricht (Betreff + Fließtext). */
const WELCOME_MESSAGE_BODY = `Betreff: Tach bei VURAX! 🃏

Erstmal vorab: Wer zum Lachen in den Keller geht, ist hier falsch. Wir servieren Infos mit Sarkasmus.

Rollenverteilung:
Wir halten die Bude am Laufen und sammeln Fehlermeldungen (und keine bunten Pappkarten).

    Unser Job: Technik & Sicherheit (dit meinen wir ernst).

    Dein Job: Sammeln & Handeln (dit is dein Bier).

Wenn die App brennt: Schreib uns. Wenn dein Tauschpartner zäher is als 'ne Woche altes Schrippen-Glurak: Da musst de alleene durch. Mitleid jibts woanders.

Macht uns stolz und macht bloß nichts kaputt – die Server waren teuer.

VURAX – Berlin, aber sicher.

Beste Grüße,
Deine VURAX-Inhaber`;

/**
 * Liefert listing_id des Willkommens-Ankers; legt ihn bei Bedarf an (falls User id 1 existiert).
 * Hintergrund: SQL 009 fügt nur ein, wenn beim ersten Ausführen schon ein User mit id=1 existierte — sonst blieb die DB leer.
 */
async function ensureWelcomeAnchorListing(client) {
  const found = await client.query(
    `SELECT l.id AS listing_id
     FROM listing l
     WHERE l.is_welcome_anchor = TRUE AND l.seller_id = $1
     LIMIT 1`,
    [WELCOME_SENDER_USER_ID]
  );
  if (found.rows[0]) {
    return Number(found.rows[0].listing_id);
  }

  const owner = await client.query(
    `SELECT 1 FROM app_user WHERE id = $1`,
    [WELCOME_SENDER_USER_ID]
  );
  if (owner.rows.length === 0) {
    console.warn(
      "[welcomeDm] Kein app_user mit id=1 — Willkommens-DM unmöglich (Inhaber-Account anlegen)."
    );
    return null;
  }

  let inserted;
  try {
    inserted = await client.query(
      `INSERT INTO listing (
         seller_id,
         sport,
         manufacturer,
         set_name,
         year,
         player_name,
         team,
         card_number,
         card_type,
         condition_grade,
         price_cents,
         currency,
         description,
         status,
         is_welcome_anchor
       )
       SELECT
         $1,
         'Support',
         'VURAX',
         '',
         2025,
         'Willkommen',
         'VURAX',
         '',
         'BASE'::card_type,
         'nm',
         0,
         'EUR',
         'Internes Anker-Listing für Willkommensnachrichten.',
         'ARCHIVED'::listing_status,
         TRUE
       WHERE NOT EXISTS (
         SELECT 1 FROM listing x WHERE x.is_welcome_anchor = TRUE
       )
       RETURNING id`,
      [WELCOME_SENDER_USER_ID]
    );
  } catch (e) {
    if (e.code === "23505") {
      inserted = { rows: [] };
    } else {
      throw e;
    }
  }

  if (inserted.rows[0]) {
    console.info(
      "[welcomeDm] Anker-Listing automatisch angelegt, id=",
      inserted.rows[0].id
    );
    return Number(inserted.rows[0].id);
  }

  const again = await client.query(
    `SELECT l.id AS listing_id
     FROM listing l
     WHERE l.is_welcome_anchor = TRUE AND l.seller_id = $1
     LIMIT 1`,
    [WELCOME_SENDER_USER_ID]
  );
  if (again.rows[0]) {
    return Number(again.rows[0].listing_id);
  }

  console.error("[welcomeDm] Anker-Listing konnte nicht ermittelt oder angelegt werden.");
  return null;
}

/**
 * Legt für einen frisch registrierten User eine Konversation mit Account id = 1 an
 * und sendet die Willkommensnachricht (Absender: User id 1).
 */
async function sendWelcomeDmToNewUser(newUserId) {
  if (process.env.WELCOME_DM_ENABLED === "0") {
    console.info("[welcomeDm] deaktiviert (WELCOME_DM_ENABLED=0).");
    return;
  }
  const buyerId = Number(newUserId);
  const sellerId = WELCOME_SENDER_USER_ID;

  if (!Number.isInteger(buyerId) || buyerId < 1) {
    return;
  }
  /** Erster registrierter Nutzer ist oft id=1 (Inhaber) — keine Konversation mit sich selbst. */
  if (buyerId === sellerId) {
    console.info(
      "[welcomeDm] übersprungen: neuer User ist id=1 (kein Selbst-Chat)."
    );
    return;
  }

  await withTransaction(async (client) => {
    const listingId = await ensureWelcomeAnchorListing(client);
    if (!listingId) {
      return;
    }

    const convRes = await client.query(
      `INSERT INTO conversation (listing_id, buyer_id, seller_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (listing_id, buyer_id) DO UPDATE SET updated_at = NOW()
       RETURNING id`,
      [listingId, buyerId, sellerId]
    );
    const conversationId = convRes.rows[0].id;

    const already = await client.query(
      `SELECT 1 FROM message
       WHERE conversation_id = $1 AND sender_id = $2
       LIMIT 1`,
      [conversationId, sellerId]
    );
    if (already.rows.length > 0) {
      return;
    }

    await client.query(
      `INSERT INTO message (conversation_id, sender_id, body)
       VALUES ($1, $2, $3)`,
      [conversationId, sellerId, WELCOME_MESSAGE_BODY]
    );

    await client.query(
      `UPDATE conversation
       SET last_message_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [conversationId]
    );

    console.info(
      "[welcomeDm] Willkommensnachricht gesendet, buyer=",
      buyerId,
      "conversation=",
      conversationId
    );
  });
}

module.exports = {
  sendWelcomeDmToNewUser,
  ensureWelcomeAnchorListing,
  WELCOME_MESSAGE_BODY,
  WELCOME_SENDER_USER_ID,
};
