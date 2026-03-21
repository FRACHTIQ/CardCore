const { query } = require("../db");

/**
 * Nach authRequired: nur Nutzer mit role = 'admin'.
 */
async function adminRequired(req, res, next) {
  try {
    const r = await query(`SELECT role FROM app_user WHERE id = $1`, [
      req.userId,
    ]);
    const row = r.rows[0];
    if (!row || row.role !== "admin") {
      return res.status(403).json({ error: "Administration erforderlich." });
    }
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { adminRequired };
