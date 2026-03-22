const { pool } = require("../db");

function socialUnlocked(row) {
  return Boolean(row && (row.is_admin || row.social_network_enabled));
}

/** Für öffentliche Profil-APIs: Links nur, wenn Nutzer freigeschaltet ist (sonst []). */
function visibleSocialLinks(userRow) {
  if (!socialUnlocked(userRow)) {
    return [];
  }
  const raw = userRow.social_links;
  return Array.isArray(raw) ? raw : [];
}

/**
 * Nach authRequired: Bearbeiten von Social-Links nur wenn Admin oder Freischaltung.
 */
async function requireSocialNetworkAccess(req, res, next) {
  try {
    const r = await pool.query(
      `SELECT is_admin, social_network_enabled FROM app_user WHERE id = $1`,
      [req.userId]
    );
    if (r.rows.length === 0) {
      return res.status(401).json({ error: "Nicht angemeldet." });
    }
    const u = r.rows[0];
    if (socialUnlocked(u)) {
      return next();
    }
    return res.status(403).json({
      error:
        "Social-Profile sind für Ihr Konto nicht freigeschaltet. Bitte wenden Sie sich an den Support.",
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  requireSocialNetworkAccess,
  socialUnlocked,
  visibleSocialLinks,
};
