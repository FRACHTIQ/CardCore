/**
 * Willkommens-DM nachträglich auslösen (z. B. User existierte vor dem Feature).
 *
 * Voraussetzung: dieselbe DATABASE_URL wie Railway (Postgres).
 *
 * Option A – Datei CardCore/.env mit Zeile:
 *   DATABASE_URL=postgresql://USER:PASS@HOST:PORT/DATABASE
 *
 * Option B – PowerShell (Session):
 *   $env:DATABASE_URL="postgresql://..."
 *   npm run welcome-dm -- 4
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

if (!String(process.env.DATABASE_URL || "").trim()) {
  console.error(
    "Fehler: DATABASE_URL ist nicht gesetzt.\n" +
      "Lege in CardCore eine Datei .env an (von Railway → Postgres → Connect kopieren)\n" +
      "oder setze in PowerShell: $env:DATABASE_URL=\"postgresql://...\""
  );
  process.exit(1);
}

const { sendWelcomeDmToNewUser } = require("../services/welcomeDm");

async function main() {
  const id = Number(process.argv[2]);
  if (!Number.isInteger(id) || id < 1) {
    console.error("Nutze: node scripts/sendWelcomeDm.js <user_id>");
    console.error("Beispiel: node scripts/sendWelcomeDm.js 4");
    process.exit(1);
  }
  const r = await sendWelcomeDmToNewUser(id);
  console.log(JSON.stringify(r, null, 2));
  process.exit(r.sent ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
