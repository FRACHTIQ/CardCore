const { query } = require("../db");
const { HttpError } = require("../utils/httpError");

function clipToken(raw) {
  const s = String(raw ?? "").trim();
  if (s.length < 20 || s.length > 512) {
    return null;
  }
  if (!s.startsWith("ExponentPushToken[")) {
    return null;
  }
  return s;
}

async function putPushToken(req, res, next) {
  try {
    const token = clipToken(req.body.expo_push_token);
    if (!token) {
      throw new HttpError(400, "Ungültiger expo_push_token.");
    }
    await query(
      `INSERT INTO user_push_token (user_id, expo_push_token, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (expo_push_token)
       DO UPDATE SET user_id = EXCLUDED.user_id, updated_at = NOW()`,
      [req.userId, token]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function deletePushTokens(req, res, next) {
  try {
    await query(`DELETE FROM user_push_token WHERE user_id = $1`, [
      req.userId,
    ]);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { putPushToken, deletePushTokens };
