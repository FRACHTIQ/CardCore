const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { query } = require("../db");
const { HttpError } = require("../utils/httpError");

function signToken(userId) {
  return jwt.sign(
    { sub: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

async function register(req, res, next) {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const displayName = String(req.body.display_name || "").trim();

    if (!email || !password) {
      throw new HttpError(400, "E-Mail und Passwort erforderlich.");
    }
    if (password.length < 8) {
      throw new HttpError(400, "Passwort mindestens 8 Zeichen.");
    }
    if (!displayName) {
      throw new HttpError(400, "Anzeigename erforderlich.");
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await query(
      `INSERT INTO app_user (email, password_hash, display_name)
       VALUES ($1, $2, $3)
       RETURNING id, email, display_name, created_at`,
      [email, hash, displayName]
    );
    const user = result.rows[0];
    const token = signToken(user.id);
    res.status(201).json({ user: { id: user.id, email: user.email, display_name: user.display_name }, token });
  } catch (err) {
    if (err.code === "23505") {
      next(new HttpError(409, "E-Mail ist bereits registriert."));
      return;
    }
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!email || !password) {
      throw new HttpError(400, "E-Mail und Passwort erforderlich.");
    }

    const result = await query(
      `SELECT id, email, password_hash, display_name FROM app_user WHERE email = $1`,
      [email]
    );
    const user = result.rows[0];
    if (!user) {
      throw new HttpError(401, "Ungültige Zugangsdaten.");
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      throw new HttpError(401, "Ungültige Zugangsdaten.");
    }
    const token = signToken(user.id);
    res.json({
      user: { id: user.id, email: user.email, display_name: user.display_name },
      token,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login };
