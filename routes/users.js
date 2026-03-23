const express = require("express");
const { pool } = require("../db");
const { authRequired } = require("../middleware/auth");
const { socialUnlocked } = require("../middleware/socialAccess");

const router = express.Router();

/**
 * GET /api/users/me — Konto + Profil (App)
 * Muss vor /:id/stats stehen.
 */
router.get("/me", authRequired, async (req, res, next) => {
  try {
    const r = await pool.query(
      `SELECT id, email, is_admin, social_network_enabled, social_links,
              display_name, bio, avatar_url, show_last_seen, last_seen_at,
              is_verified, private_market_access,
              legal_name, phone, street, address_extra, postal_code, city, country,
              avg_response_hours, response_metric_samples
       FROM app_user WHERE id = $1`,
      [req.userId]
    );
    const u = r.rows[0];
    if (!u) {
      return res.status(401).json({ error: "Nicht angemeldet." });
    }
    return res.json({
      user: {
        id: u.id,
        email: u.email,
        role: u.is_admin ? "admin" : "user",
        is_admin: Boolean(u.is_admin),
        social_network_enabled: Boolean(u.social_network_enabled),
        social_network_unlocked: socialUnlocked(u),
        social_links: Array.isArray(u.social_links) ? u.social_links : [],
        display_name: u.display_name || "",
        bio: u.bio || "",
        avatar_url: u.avatar_url || "",
        show_last_seen: u.show_last_seen !== false,
        last_seen_at: u.last_seen_at,
        is_verified: Boolean(u.is_verified),
        private_market_access: Boolean(u.private_market_access),
        legal_name: u.legal_name || "",
        phone: u.phone || "",
        street: u.street || "",
        address_extra: u.address_extra || "",
        postal_code: u.postal_code || "",
        city: u.city || "",
        country: u.country || "",
        avg_response_hours:
          u.avg_response_hours != null ? Number(u.avg_response_hours) : null,
        response_metric_samples: Number(u.response_metric_samples || 0),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/users/me — Profilfelder (Teilmengen)
 */
router.patch("/me", authRequired, async (req, res, next) => {
  try {
    const b = req.body || {};
    const fields = [];
    const params = [];
    let n = 1;

    const str = (v, max) => String(v ?? "").trim().slice(0, max);

    if (Object.prototype.hasOwnProperty.call(b, "display_name")) {
      fields.push(`display_name = $${n}`);
      params.push(str(b.display_name, 200));
      n += 1;
    }
    if (Object.prototype.hasOwnProperty.call(b, "bio")) {
      fields.push(`bio = $${n}`);
      params.push(str(b.bio, 4000));
      n += 1;
    }
    if (Object.prototype.hasOwnProperty.call(b, "avatar_url")) {
      fields.push(`avatar_url = $${n}`);
      const av = b.avatar_url === "" ? "" : String(b.avatar_url || "").slice(0, 500_000);
      params.push(av);
      n += 1;
    }
    if (Object.prototype.hasOwnProperty.call(b, "show_last_seen")) {
      fields.push(`show_last_seen = $${n}`);
      params.push(Boolean(b.show_last_seen));
      n += 1;
    }
    if (Object.prototype.hasOwnProperty.call(b, "social_links")) {
      if (!Array.isArray(b.social_links)) {
        return res.status(400).json({ error: "social_links muss ein Array sein." });
      }
      const slim = b.social_links
        .filter((x) => x && typeof x === "object")
        .map((x) => ({
          platform: str(x.platform, 80),
          url: str(x.url, 2048),
        }))
        .filter((x) => x.url.length > 0)
        .slice(0, 20);
      fields.push(`social_links = $${n}::jsonb`);
      params.push(JSON.stringify(slim));
      n += 1;
    }
    const trade = [
      ["legal_name", 200],
      ["phone", 80],
      ["street", 300],
      ["address_extra", 200],
      ["postal_code", 32],
      ["city", 120],
      ["country", 8],
    ];
    for (const [key, max] of trade) {
      if (Object.prototype.hasOwnProperty.call(b, key)) {
        fields.push(`${key} = $${n}`);
        params.push(str(b[key], max));
        n += 1;
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: "Keine gültigen Felder." });
    }

    params.push(req.userId);
    const r = await pool.query(
      `UPDATE app_user SET ${fields.join(", ")}
       WHERE id = $${n}
       RETURNING id, email, is_admin, social_network_enabled, social_links,
                 display_name, bio, avatar_url, show_last_seen, last_seen_at,
                 is_verified, private_market_access,
                 legal_name, phone, street, address_extra, postal_code, city, country,
                 avg_response_hours, response_metric_samples`,
      params
    );
    const u = r.rows[0];
    return res.json({
      user: {
        id: u.id,
        email: u.email,
        role: u.is_admin ? "admin" : "user",
        is_admin: Boolean(u.is_admin),
        social_network_enabled: Boolean(u.social_network_enabled),
        social_network_unlocked: socialUnlocked(u),
        social_links: Array.isArray(u.social_links) ? u.social_links : [],
        display_name: u.display_name || "",
        bio: u.bio || "",
        avatar_url: u.avatar_url || "",
        show_last_seen: u.show_last_seen !== false,
        last_seen_at: u.last_seen_at,
        is_verified: Boolean(u.is_verified),
        private_market_access: Boolean(u.private_market_access),
        legal_name: u.legal_name || "",
        phone: u.phone || "",
        street: u.street || "",
        address_extra: u.address_extra || "",
        postal_code: u.postal_code || "",
        city: u.city || "",
        country: u.country || "",
        avg_response_hours:
          u.avg_response_hours != null ? Number(u.avg_response_hours) : null,
        response_metric_samples: Number(u.response_metric_samples || 0),
      },
    });
  } catch (err) {
    next(err);
  }
});

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
