const { query } = require("../db");
const { HttpError } = require("../utils/httpError");

const L = {
  legal_name: 200,
  phone: 40,
  street: 200,
  address_extra: 200,
  postal_code: 20,
  city: 120,
  country: 2,
  /** Data-URL (base64) – Obergrenze gegen Missbrauch */
  avatar_url: 400000,
};

function clip(s, max) {
  return String(s ?? "")
    .trim()
    .slice(0, max);
}

function normCountry(raw) {
  const s = clip(raw, L.country).toUpperCase();
  if (s.length === 0) {
    return "DE";
  }
  return s.slice(0, 2);
}

const ME_SELECT = `SELECT id, email, display_name, bio,
  legal_name, phone, street, address_extra, postal_code, city, country,
  avatar_url,
  created_at, updated_at
  FROM app_user WHERE id = $1`;

async function getMe(req, res, next) {
  try {
    const result = await query(ME_SELECT, [req.userId]);
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

    const legalName =
      req.body.legal_name !== undefined
        ? clip(req.body.legal_name, L.legal_name)
        : null;
    const phone =
      req.body.phone !== undefined ? clip(req.body.phone, L.phone) : null;
    const street =
      req.body.street !== undefined ? clip(req.body.street, L.street) : null;
    const addressExtra =
      req.body.address_extra !== undefined
        ? clip(req.body.address_extra, L.address_extra)
        : null;
    const postalCode =
      req.body.postal_code !== undefined
        ? clip(req.body.postal_code, L.postal_code)
        : null;
    const city =
      req.body.city !== undefined ? clip(req.body.city, L.city) : null;
    const country =
      req.body.country !== undefined ? normCountry(req.body.country) : null;
    const avatarUrl =
      req.body.avatar_url !== undefined
        ? clip(req.body.avatar_url, L.avatar_url)
        : null;

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
    if (legalName !== null) {
      fields.push(`legal_name = $${i++}`);
      values.push(legalName);
    }
    if (phone !== null) {
      fields.push(`phone = $${i++}`);
      values.push(phone);
    }
    if (street !== null) {
      fields.push(`street = $${i++}`);
      values.push(street);
    }
    if (addressExtra !== null) {
      fields.push(`address_extra = $${i++}`);
      values.push(addressExtra);
    }
    if (postalCode !== null) {
      fields.push(`postal_code = $${i++}`);
      values.push(postalCode);
    }
    if (city !== null) {
      fields.push(`city = $${i++}`);
      values.push(city);
    }
    if (country !== null) {
      fields.push(`country = $${i++}`);
      values.push(country);
    }
    if (avatarUrl !== null) {
      if (
        avatarUrl.length > 0 &&
        !avatarUrl.startsWith("data:image/")
      ) {
        throw new HttpError(400, "Profilbild muss eine gültige Bild-Data-URL sein.");
      }
      fields.push(`avatar_url = $${i++}`);
      values.push(avatarUrl);
    }

    if (fields.length === 0) {
      throw new HttpError(400, "Keine Felder zum Aktualisieren.");
    }

    fields.push(`updated_at = NOW()`);
    values.push(req.userId);

    const sql = `
      UPDATE app_user SET ${fields.join(", ")}
      WHERE id = $${i}
      RETURNING id, email, display_name, bio,
        legal_name, phone, street, address_extra, postal_code, city, country,
        created_at, updated_at
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
         u.avatar_url,
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
        avatar_url: row.avatar_url || "",
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

async function deleteMe(req, res, next) {
  try {
    const result = await query(`DELETE FROM app_user WHERE id = $1 RETURNING id`, [
      req.userId,
    ]);
    const deleted = result.rowCount ?? result.rows?.length ?? 0;
    if (deleted === 0) {
      throw new HttpError(404, "Benutzer nicht gefunden.");
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { getMe, patchMe, getPublicProfile, deleteMe };
