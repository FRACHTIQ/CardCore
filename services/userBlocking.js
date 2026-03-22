const { query } = require("../db");
const { HttpError } = require("../utils/httpError");

/**
 * @param {number} a
 * @param {number} b
 */
async function isPairBlocked(a, b) {
  if (!a || !b || a === b) {
    return false;
  }
  const r = await query(
    `SELECT 1 FROM user_block
     WHERE (blocker_id = $1 AND blocked_id = $2)
        OR (blocker_id = $2 AND blocked_id = $1)
     LIMIT 1`,
    [a, b]
  );
  return r.rows.length > 0;
}

/**
 * Wirft 403, wenn eine Blockbeziehung zwischen beiden Nutzern besteht.
 * @param {number} viewerId
 * @param {number} otherId
 */
async function assertNotBlocked(viewerId, otherId) {
  if (!viewerId || !otherId || viewerId === otherId) {
    return;
  }
  if (await isPairBlocked(viewerId, otherId)) {
    throw new HttpError(
      403,
      "Mit diesem Nutzer ist keine Konversation möglich."
    );
  }
}

module.exports = { isPairBlocked, assertNotBlocked };
