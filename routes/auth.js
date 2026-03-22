const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool } = require("../db");
const { sendWelcomeDmToNewUser } = require("../services/welcomeDm");
const { authRequired } = require("../middleware/auth");
const { socialUnlocked } = require("../middleware/socialAccess");

const router = express.Router();

function signToken(userId) {
  return jwt.sign(
    { sub: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

router.post("/register", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  if (!email || !password) {
    return res.status(400).json({ error: "E-Mail und Passwort erforderlich." });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Passwort mindestens 8 Zeichen." });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO app_user (email, password_hash)
       VALUES ($1, $2)
       RETURNING id, email, created_at, is_admin, social_network_enabled`,
      [email, hash]
    );
    const user = result.rows[0];
    const token = signToken(user.id);
    let welcomeDm = { sent: false, reason: "error" };
    try {
      welcomeDm = await sendWelcomeDmToNewUser(user.id);
    } catch (e) {
      console.error("[auth] welcome DM:", e && e.stack ? e.stack : e);
      welcomeDm = { sent: false, reason: "exception" };
    }
    return res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        is_admin: Boolean(user.is_admin),
        social_network_enabled: Boolean(user.social_network_enabled),
        social_network_unlocked: socialUnlocked(user),
      },
      token,
      welcome_dm: welcomeDm,
    });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "E-Mail ist bereits registriert." });
    }
    console.error(err);
    return res.status(500).json({ error: "Serverfehler." });
  }
});

router.post("/login", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  if (!email || !password) {
    return res.status(400).json({ error: "E-Mail und Passwort erforderlich." });
  }

  try {
    const result = await pool.query(
      `SELECT id, email, password_hash, is_admin, social_network_enabled
       FROM app_user WHERE email = $1`,
      [email]
    );
    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: "Ungültige Zugangsdaten." });
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "Ungültige Zugangsdaten." });
    }
    const token = signToken(user.id);
    return res.json({
      user: {
        id: user.id,
        email: user.email,
        is_admin: Boolean(user.is_admin),
        social_network_enabled: Boolean(user.social_network_enabled),
        social_network_unlocked: socialUnlocked(user),
      },
      token,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Serverfehler." });
  }
});

/** Aktueller Nutzer inkl. Social-Flags; social_links nur sichtbar wenn freigeschaltet. */
router.get("/me", authRequired, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, email, is_admin, social_network_enabled, social_links,
              avg_response_hours, response_metric_samples
       FROM app_user WHERE id = $1`,
      [req.userId]
    );
    const u = result.rows[0];
    if (!u) {
      return res.status(401).json({ error: "Nicht angemeldet." });
    }
    const unlocked = socialUnlocked(u);
    return res.json({
      user: {
        id: u.id,
        email: u.email,
        is_admin: Boolean(u.is_admin),
        social_network_enabled: Boolean(u.social_network_enabled),
        social_network_unlocked: unlocked,
        social_links: unlocked ? u.social_links : [],
        avg_response_hours:
          u.avg_response_hours != null ? Number(u.avg_response_hours) : null,
        response_metric_samples: Number(u.response_metric_samples || 0),
      },
    });
  } catch (err) {
    console.error("[auth] /me:", err);
    return res.status(500).json({ error: "Serverfehler." });
  }
});

module.exports = router;
