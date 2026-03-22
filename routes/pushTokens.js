const express = require("express");
const { pool } = require("../db");
const { authRequired } = require("../middleware/auth");

const router = express.Router();
router.use(authRequired);

/** POST /api/push-tokens { expo_push_token } */
router.post("/", async (req, res, next) => {
  try {
    const token = String(req.body.expo_push_token || "").trim();
    if (token.length < 20) {
      return res.status(400).json({ error: "expo_push_token erforderlich." });
    }
    await pool.query(
      `INSERT INTO user_push_token (user_id, expo_push_token, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id, expo_push_token) DO UPDATE SET updated_at = NOW()`,
      [req.userId, token]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/push-tokens — Token entfernen (Logout) */
router.delete("/", async (req, res, next) => {
  try {
    const token = String(req.body.expo_push_token || "").trim();
    if (token) {
      await pool.query(
        `DELETE FROM user_push_token WHERE user_id = $1 AND expo_push_token = $2`,
        [req.userId, token]
      );
    } else {
      await pool.query(`DELETE FROM user_push_token WHERE user_id = $1`, [
        req.userId,
      ]);
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
