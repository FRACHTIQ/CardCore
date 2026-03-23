const express = require("express");
const { pool } = require("../db");
const { authRequired } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/admin");

const router = express.Router();
router.use(authRequired);
router.use(requireAdmin);

/**
 * PATCH /api/admin/users/:id
 * Body: { social_network_enabled?: boolean, is_admin?: boolean, private_market_access?: boolean }
 */
router.patch("/users/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: "Ungültige ID." });
    }

    const hasSocial = Object.prototype.hasOwnProperty.call(
      req.body,
      "social_network_enabled"
    );
    const hasAdmin = Object.prototype.hasOwnProperty.call(req.body, "is_admin");
    const hasPrivateMarket = Object.prototype.hasOwnProperty.call(
      req.body,
      "private_market_access"
    );

    if (!hasSocial && !hasAdmin && !hasPrivateMarket) {
      return res.status(400).json({
        error:
          "Mindestens social_network_enabled, is_admin oder private_market_access angeben.",
      });
    }

    const fields = [];
    const params = [];
    let n = 1;
    if (hasSocial) {
      fields.push(`social_network_enabled = $${n}::boolean`);
      params.push(Boolean(req.body.social_network_enabled));
      n += 1;
    }
    if (hasAdmin) {
      fields.push(`is_admin = $${n}::boolean`);
      params.push(Boolean(req.body.is_admin));
      n += 1;
    }
    if (hasPrivateMarket) {
      fields.push(`private_market_access = $${n}::boolean`);
      params.push(Boolean(req.body.private_market_access));
      n += 1;
    }
    params.push(id);

    const r = await pool.query(
      `UPDATE app_user SET ${fields.join(", ")}
       WHERE id = $${n}
       RETURNING id, email, is_admin, social_network_enabled, private_market_access`,
      params
    );
    if (r.rows.length === 0) {
      return res.status(404).json({ error: "Nutzer nicht gefunden." });
    }
    res.json({ user: r.rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
