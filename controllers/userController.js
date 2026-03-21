const { query } = require("../db");
const { HttpError } = require("../utils/httpError");

async function getMe(req, res, next) {
  try {
    const result = await query(
      `SELECT id, email, display_name, bio, created_at, updated_at
       FROM app_user WHERE id = $1`,
      [req.userId]
    );
    const user = result.rows[0];
    if (!user) {
      throw new HttpError(404, "Benutzer nicht gefunden.");
    }
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

async function patchMe(req, res, next) {
  try {
    const displayName =
      req.body.display_name !== undefined
        ? String(req.body.display_name).trim()
        : null;
    const bio =
      req.body.bio !== undefined ? String(req.body.bio) : null;

    if (displayName !== null && displayName.length === 0) {
      throw new HttpError(400, "Anzeigename darf nicht leer sein.");
    }

    const fields = [];
    const values = [];
    let i = 1;

    if (displayName !== null) {
      fields.push(`display_name = $${i++}`);
      values.push(displayName);
    }
    if (bio !== null) {
      fields.push(`bio = $${i++}`);
      values.push(bio);
    }

    if (fields.length === 0) {
      throw new HttpError(400, "Keine Felder zum Aktualisieren.");
    }

    fields.push(`updated_at = NOW()`);
    values.push(req.userId);

    const sql = `
      UPDATE app_user SET ${fields.join(", ")}
      WHERE id = $${i}
      RETURNING id, email, display_name, bio, created_at, updated_at
    `;
    const result = await query(sql, values);
    res.json({ user: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

async function getPublicProfile(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      throw new HttpError(400, "Ungültige ID.");
    }

    const result = await query(
      `SELECT
         u.id,
         u.display_name,
         u.bio,
         u.created_at,
         COALESCE((SELECT AVG(r.rating)::float FROM review r WHERE r.seller_id = u.id), 0) AS rating_avg,
         COALESCE((SELECT COUNT(*)::int FROM review r WHERE r.seller_id = u.id), 0) AS rating_count,
         COALESCE((SELECT COUNT(*)::int FROM listing l WHERE l.seller_id = u.id AND l.status = 'ACTIVE'), 0) AS active_listings_count,
         COALESCE((SELECT COUNT(*)::int FROM listing l WHERE l.seller_id = u.id AND l.status = 'SOLD'), 0) AS sold_count
       FROM app_user u
       WHERE u.id = $1`,
      [id]
    );
    const row = result.rows[0];
    if (!row) {
      throw new HttpError(404, "Profil nicht gefunden.");
    }

    res.json({
      profile: {
        id: row.id,
        display_name: row.display_name,
        bio: row.bio,
        created_at: row.created_at,
        rating_avg: row.rating_avg !== null ? Number(row.rating_avg) : 0,
        rating_count: row.rating_count,
        active_listings_count: row.active_listings_count,
        sold_count: row.sold_count,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getMe, patchMe, getPublicProfile };
