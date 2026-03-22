const express = require("express");
const { pool } = require("../db");
const { authRequired } = require("../middleware/auth");

const router = express.Router();
router.use(authRequired);

/** GET /api/moderation/blocks */
router.get("/blocks", async (req, res, next) => {
  try {
    const r = await pool.query(
      `SELECT blocked_id, created_at FROM user_block WHERE blocker_id = $1 ORDER BY created_at DESC`,
      [req.userId]
    );
    res.json({ blocks: r.rows });
  } catch (err) {
    next(err);
  }
});

/** POST /api/moderation/blocks/:userId */
router.post("/blocks/:userId", async (req, res, next) => {
  try {
    const blockedId = Number(req.params.userId);
    const blockerId = Number(req.userId);
    if (!Number.isInteger(blockedId) || blockedId < 1) {
      return res.status(400).json({ error: "Ungültige Nutzer-ID." });
    }
    if (blockedId === blockerId) {
      return res.status(400).json({ error: "Sie können sich nicht selbst blockieren." });
    }
    const exists = await pool.query(`SELECT 1 FROM app_user WHERE id = $1`, [
      blockedId,
    ]);
    if (exists.rows.length === 0) {
      return res.status(404).json({ error: "Nutzer nicht gefunden." });
    }
    await pool.query(
      `INSERT INTO user_block (blocker_id, blocked_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [blockerId, blockedId]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/moderation/blocks/:userId */
router.delete("/blocks/:userId", async (req, res, next) => {
  try {
    const blockedId = Number(req.params.userId);
    if (!Number.isInteger(blockedId) || blockedId < 1) {
      return res.status(400).json({ error: "Ungültige Nutzer-ID." });
    }
    await pool.query(
      `DELETE FROM user_block WHERE blocker_id = $1 AND blocked_id = $2`,
      [req.userId, blockedId]
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

/** POST /api/moderation/reports */
router.post("/reports", async (req, res, next) => {
  try {
    const reportedId = Number(req.body.reported_id);
    const reason = String(req.body.reason || "").trim();
    const details = req.body.details
      ? String(req.body.details).trim().slice(0, 4000)
      : null;
    const reporterId = Number(req.userId);

    if (!Number.isInteger(reportedId) || reportedId < 1) {
      return res.status(400).json({ error: "reported_id erforderlich." });
    }
    if (reportedId === reporterId) {
      return res.status(400).json({ error: "Ungültige Meldung." });
    }
    if (reason.length < 3) {
      return res.status(400).json({ error: "Grund (mindestens 3 Zeichen) erforderlich." });
    }

    const exists = await pool.query(`SELECT 1 FROM app_user WHERE id = $1`, [
      reportedId,
    ]);
    if (exists.rows.length === 0) {
      return res.status(404).json({ error: "Nutzer nicht gefunden." });
    }

    const ins = await pool.query(
      `INSERT INTO user_report (reporter_id, reported_id, reason, details)
       VALUES ($1, $2, $3, $4)
       RETURNING id, created_at, status`,
      [reporterId, reportedId, reason, details]
    );
    res.status(201).json({ report: ins.rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
