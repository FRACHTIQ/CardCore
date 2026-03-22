const { pool } = require("../db");

async function requireAdmin(req, res, next) {
  try {
    const r = await pool.query(`SELECT is_admin FROM app_user WHERE id = $1`, [
      req.userId,
    ]);
    if (!r.rows[0] || !r.rows[0].is_admin) {
      return res.status(403).json({ error: "Keine Administrator-Berechtigung." });
    }
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireAdmin };
