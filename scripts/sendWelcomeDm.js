/**
 * Willkommens-DM nachträglich auslösen (z. B. User existierte vor dem Feature).
 *
 *   set DATABASE_URL=...   (oder .env)
 *   node scripts/sendWelcomeDm.js 4
 */
require("dotenv").config();
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
