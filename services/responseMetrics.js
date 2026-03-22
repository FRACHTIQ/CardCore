/**
 * Rollierender Mittelwert der Antwortzeit (Stunden): Verkäufer antwortet auf letzte Käufer-Nachricht.
 */
async function recordSellerResponseHours(client, { conversationId, newMessageId }) {
  const conv = await client.query(
    `SELECT seller_id, buyer_id FROM conversation WHERE id = $1`,
    [conversationId]
  );
  const c = conv.rows[0];
  if (!c) {
    return;
  }

  const cur = await client.query(
    `SELECT sender_id, created_at FROM message WHERE id = $1`,
    [newMessageId]
  );
  const msg = cur.rows[0];
  if (!msg || msg.sender_id !== c.seller_id) {
    return;
  }

  const prev = await client.query(
    `SELECT sender_id, created_at FROM message
     WHERE conversation_id = $1 AND id < $2
     ORDER BY id DESC LIMIT 1`,
    [conversationId, newMessageId]
  );
  if (!prev.rows[0] || prev.rows[0].sender_id !== c.buyer_id) {
    return;
  }

  const hours =
    (new Date(msg.created_at) - new Date(prev.rows[0].created_at)) / 3600000;
  if (!Number.isFinite(hours) || hours < 0) {
    return;
  }

  await client.query(
    `UPDATE app_user SET
       response_metric_samples = response_metric_samples + 1,
       avg_response_hours = (
         COALESCE(avg_response_hours, 0) * response_metric_samples + $2::numeric
       ) / (response_metric_samples + 1)::numeric
     WHERE id = $1`,
    [c.seller_id, hours]
  );
}

module.exports = { recordSellerResponseHours };
