const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool } = require("../db");
const { sendWelcomeDmToNewUser } = require("../services/welcomeDm");

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
       RETURNING id, email, created_at`,
      [email, hash]
    );
    const user = result.rows[0];
    const token = signToken(user.id);
    try {
      await sendWelcomeDmToNewUser(user.id);
    } catch (e) {
      console.error("[auth] welcome DM:", e && e.stack ? e.stack : e);
    }
    return res.status(201).json({ user: { id: user.id, email: user.email }, token });
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
      `SELECT id, email, password_hash FROM app_user WHERE email = $1`,
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
      user: { id: user.id, email: user.email },
      token,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Serverfehler." });
  }
});

module.exports = router;
