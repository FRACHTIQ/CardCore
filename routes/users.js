const express = require("express");
const { pool } = require("../db");

const router = express.Router();

/**
 * GET /api/users/:id/stats — öffentlich: Antwortzeit-Metrik (Profil)
 */
router.get("/:id/stats", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: "Ungültige ID." });
    }
    const r = await pool.query(
      `SELECT id,
              avg_response_hours,
              response_metric_samples
       FROM app_user WHERE id = $1`,
      [id]
    );
    const u = r.rows[0];
    if (!u) {
      return res.status(404).json({ error: "Nutzer nicht gefunden." });
    }
    return res.json({
      user: {
        id: u.id,
        avg_response_hours:
          u.avg_response_hours != null ? Number(u.avg_response_hours) : null,
        response_metric_samples: Number(u.response_metric_samples || 0),
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
