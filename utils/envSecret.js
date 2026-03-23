/**
 * Trim + umschließende Quotes entfernen (häufig bei Railway/Copy-Paste).
 * @param {string | undefined} raw
 * @returns {string}
 */
function normalizeEnvSecret(raw) {
  let k = String(raw || "").trim();
  if (
    (k.startsWith('"') && k.endsWith('"')) ||
    (k.startsWith("'") && k.endsWith("'"))
  ) {
    k = k.slice(1, -1).trim();
  }
  return k;
}

module.exports = { normalizeEnvSecret };
