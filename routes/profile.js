const express = require("express");
const { pool } = require("../db");
const { authRequired } = require("../middleware/auth");
const { requireSocialNetworkAccess } = require("../middleware/socialAccess");

const router = express.Router();

function normalizeSocialLinks(raw) {
  if (!Array.isArray(raw)) {
    return null;
  }
  if (raw.length > 30) {
    return null;
  }
  const out = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") {
      return null;
    }
    const label = String(item.label ?? "").trim().slice(0, 120);
    const url = String(item.url ?? "").trim().slice(0, 2048);
    if (!url) {
      continue;
    }
    out.push({ label, url });
    if (out.length >= 20) {
      break;
    }
  }
  return out;
}

/**
 * PATCH /api/profile/social-links
 * Body: { "social_links": [ { "label": "…", "url": "https://…" }, … ] }
 */
router.patch(
  "/social-links",
  authRequired,
  requireSocialNetworkAccess,
  async (req, res) => {
    const normalized = normalizeSocialLinks(req.body.social_links);
    if (normalized === null) {
      return res.status(400).json({
        error:
          "social_links muss ein Array sein (max. 20 Einträge mit label/url).",
      });
    }

    try {
      const result = await pool.query(
        `UPDATE app_user
         SET social_links = $1::jsonb
         WHERE id = $2
         RETURNING id, social_links`,
        [JSON.stringify(normalized), req.userId]
      );
      return res.json({ social_links: result.rows[0].social_links });
    } catch (err) {
      console.error("[profile] social-links:", err);
      return res.status(500).json({ error: "Serverfehler." });
    }
  }
);

module.exports = router;
