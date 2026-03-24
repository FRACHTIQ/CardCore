/**
 * Legt einen Admin-Nutzer an oder setzt role=admin (und optional Passwort).
 *
 * Voraussetzung: .env mit DATABASE_URL (bei Railway von lokal oft NODE_ENV=production nötig für SSL).
 *
 *   node scripts/create-admin.js <email> <passwort> [anzeigename]
 *   oder: ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/create-admin.js
 */
require("dotenv").config();
const bcrypt = require("bcryptjs");
const { query, pool } = require("../db");

async function main() {
  const emailRaw =
    process.argv[2] || process.env.ADMIN_EMAIL || process.env.EMAIL;
  const password =
    process.argv[3] || process.env.ADMIN_PASSWORD || process.env.PASSWORD;
  const displayName =
    (process.argv[4] || process.env.ADMIN_DISPLAY_NAME || "Admin").trim();

  const email = String(emailRaw || "")
    .trim()
    .toLowerCase();

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL fehlt in .env");
    process.exit(1);
  }
  if (!email || !password) {
    console.error(
      "Aufruf: node scripts/create-admin.js <email> <passwort> [anzeigename]\n" +
        "Oder ADMIN_EMAIL und ADMIN_PASSWORD in .env setzen."
    );
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Passwort mindestens 8 Zeichen.");
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 10);

  const existing = await query(`SELECT id, email FROM app_user WHERE email = $1`, [
    email,
  ]);

  if (existing.rows[0]) {
    await query(
      `UPDATE app_user
       SET role = 'admin', password_hash = $2, updated_at = NOW()
       WHERE email = $1`,
      [email, hash]
    );
    console.log("OK: Bestehendes Konto – Rolle admin, Passwort aktualisiert:", email);
  } else {
    await query(
      `INSERT INTO app_user (email, password_hash, display_name, terms_accepted_at, role)
       VALUES ($1, $2, $3, NOW(), 'admin')`,
      [email, hash, displayName || "Admin"]
    );
    console.log("OK: Neuer Admin-Nutzer:", email);
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
