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

const ALLOWED_SOCIAL = new Set([
  "instagram",
  "x",
  "tiktok",
  "youtube",
  "facebook",
  "discord",
  "twitch",
  "website",
]);

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

function parseSocialLinks(raw) {
  if (raw === undefined) {
    return null;
  }
  if (!Array.isArray(raw)) {
    throw new HttpError(400, "social_links muss ein Array sein.");
  }
  if (raw.length > 8) {
    throw new HttpError(400, "Maximal 8 Social-Links.");
  }
  const out = [];
  for (const item of raw) {
    const platform = String(item.platform || "")
      .toLowerCase()
      .trim();
    const url = String(item.url || "")
      .trim()
      .slice(0, 500);
    if (!platform) {
      continue;
    }
    if (!ALLOWED_SOCIAL.has(platform)) {
      throw new HttpError(400, "Ungültige oder nicht unterstützte Plattform.");
    }
    if (!url) {
      continue;
    }
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      throw new HttpError(400, "Ungültige URL.");
    }
    const isHttps = parsed.protocol === "https:";
    const isHttp = parsed.protocol === "http:";
    if (platform === "website" && (isHttps || isHttp)) {
      /* ok */
    } else if (!isHttps) {
      throw new HttpError(400, "URL muss mit https:// beginnen.");
    }
    out.push({ platform, url });
  }
  return out;
}

const ME_SELECT = `SELECT id, email, display_name, bio,
  legal_name, phone, street, address_extra, postal_code, city, country,
  avatar_url,
  role,
  is_verified,
  last_seen_at,
  social_links,
  show_last_seen,
  created_at, updated_at
  FROM app_user WHERE id = $1`;

const ME_RETURNING = `id, email, display_name, bio,
  legal_name, phone, street, address_extra, postal_code, city, country,
  avatar_url,
  role,
  is_verified,
  last_seen_at,
  social_links,
  show_last_seen,
  created_at, updated_at`;

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

async function heartbeatPresence(req, res, next) {
  try {
    const result = await query(
      `UPDATE app_user SET last_seen_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING last_seen_at`,
      [req.userId]
    );
    const row = result.rows[0];
    res.json({ last_seen_at: row?.last_seen_at || null });
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

    const socialLinksParsed =
      req.body.social_links !== undefined
        ? parseSocialLinks(req.body.social_links)
        : null;

    const showLastSeen =
      req.body.show_last_seen !== undefined
        ? Boolean(req.body.show_last_seen)
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
    if (socialLinksParsed !== null) {
      fields.push(`social_links = $${i++}::jsonb`);
      values.push(JSON.stringify(socialLinksParsed));
    }
    if (showLastSeen !== null) {
      fields.push(`show_last_seen = $${i++}`);
      values.push(showLastSeen);
    }

    if (fields.length === 0) {
      throw new HttpError(400, "Keine Felder zum Aktualisieren.");
    }

    fields.push(`updated_at = NOW()`);
    values.push(req.userId);

    const sql = `
      UPDATE app_user SET ${fields.join(", ")}
      WHERE id = $${i}
      RETURNING ${ME_RETURNING}
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
         u.is_verified,
         u.created_at,
         COALESCE(u.social_links, '[]'::jsonb) AS social_links,
         CASE
           WHEN u.show_last_seen IS TRUE
            AND u.last_seen_at IS NOT NULL
            AND u.last_seen_at >= NOW() - INTERVAL '5 minutes'
           THEN TRUE
           ELSE FALSE
         END AS is_online,
         CASE WHEN u.show_last_seen THEN u.last_seen_at ELSE NULL END AS last_seen_at,
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

    const rawSocial = row.social_links;
    const social = Array.isArray(rawSocial) ? rawSocial : [];

    res.json({
      profile: {
        id: row.id,
        display_name: row.display_name,
        bio: row.bio,
        avatar_url: row.avatar_url || "",
        is_verified: Boolean(row.is_verified),
        created_at: row.created_at,
        social_links: social,
        is_online: Boolean(row.is_online),
        last_seen_at: row.last_seen_at,
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

module.exports = {
  getMe,
  patchMe,
  getPublicProfile,
  deleteMe,
  heartbeatPresence,
};
