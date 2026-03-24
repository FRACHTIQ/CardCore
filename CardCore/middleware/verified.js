const { query } = require("../db");
const { HttpError } = require("../utils/httpError");

async function verifiedRequired(req, res, next) {
  try {
    if (process.env.ALLOW_UNVERIFIED_TRADING === "1") {
      return next();
    }
    const r = await query(
      `SELECT is_verified, suspended_at FROM app_user WHERE id = $1`,
      [req.userId]
    );
    const row = r.rows[0];
    if (!row) {
      throw new HttpError(401, "Nicht angemeldet.");
    }
    if (row.suspended_at) {
      throw new HttpError(403, "Konto gesperrt.");
    }
    if (!row.is_verified) {
      throw new HttpError(403, "Verifizierung erforderlich.");
    }
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { verifiedRequired };
