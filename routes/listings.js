const express = require("express");
const { pool } = require("../db");
const { authRequired, optionalAuth } = require("../middleware/auth");
const { HttpError } = require("../utils/httpError");
const { fireAndNotifyNewListing } = require("../services/expoPush");

const router = express.Router();

const LISTING_STATUSES = new Set(["DRAFT", "ACTIVE", "SOLD", "ARCHIVED"]);

function parseIntSafe(v, def, min, max) {
  const n = Number.parseInt(String(v), 10);
  if (!Number.isFinite(n)) {
    return def;
  }
  return Math.min(Math.max(n, min), max);
}

async function userHasPrivateMarketAccess(userId) {
  const uid = userId != null ? Number(userId) : NaN;
  if (!Number.isInteger(uid) || uid < 1) {
    return false;
  }
  const r = await pool.query(
    `SELECT private_market_access FROM app_user WHERE id = $1`,
    [uid]
  );
  return Boolean(r.rows[0]?.private_market_access);
}

const SORT_WHITELIST = {
  created_at_desc: "l.created_at DESC",
  updated_at_desc: "l.updated_at DESC NULLS LAST, l.created_at DESC",
  price_asc: "l.price_cents ASC NULLS LAST, l.created_at DESC",
  price_desc: "l.price_cents DESC NULLS LAST, l.created_at DESC",
  year_desc: "l.year DESC NULLS LAST, l.created_at DESC",
};

/** GET /api/listings — öffentlich oder Private Market (?private_market=1 + Zugang) */
router.get("/", optionalAuth, async (req, res, next) => {
  try {
    const searchText = String(req.query.search || req.query.q || "")
      .trim()
      .slice(0, 200);
    const sport = String(req.query.sport || "").trim().slice(0, 80);
    const manufacturer = String(req.query.manufacturer || "").trim().slice(0, 120);
    const team = String(req.query.team || "").trim().slice(0, 120);
    const cardNumber = String(req.query.card_number || "").trim().slice(0, 80);
    const conditionGrade = String(req.query.condition_grade || "").trim().slice(0, 80);
    const cardTypeRaw = String(req.query.card_type || "").trim().toUpperCase();
    const status = String(req.query.status || "ACTIVE").toUpperCase();
    if (!LISTING_STATUSES.has(status)) {
      throw new HttpError(400, "Ungültiger status.");
    }
    const limit = parseIntSafe(req.query.limit, 24, 1, 100);
    const offset = parseIntSafe(req.query.offset, 0, 0, 1_000_000);

    const pm = String(req.query.private_market || "").toLowerCase();
    const scope = String(req.query.scope || "").toLowerCase();
    const privateOnly =
      pm === "1" || pm === "true" || scope === "private";

    const canPrivate = await userHasPrivateMarketAccess(req.userId);
    if (privateOnly) {
      if (!req.userId || !canPrivate) {
        throw new HttpError(403, "Kein Zugang zum Private Market.");
      }
    }

    const sortKey = String(req.query.sort || "created_at_desc");
    const orderBy = SORT_WHITELIST[sortKey] || SORT_WHITELIST.created_at_desc;

    const params = [status];
    let where = `l.status = $1::listing_status AND COALESCE(l.is_welcome_anchor, false) = false`;
    let p = 2;

    if (privateOnly) {
      where += ` AND COALESCE(l.is_private_market, false) = true`;
    } else {
      where += ` AND COALESCE(l.is_private_market, false) = false`;
    }

    const sellerRaw = req.query.seller_id;
    if (sellerRaw !== undefined && String(sellerRaw).trim() !== "") {
      const sellerId = Number(sellerRaw);
      if (Number.isInteger(sellerId) && sellerId >= 1) {
        where += ` AND l.seller_id = $${p}`;
        params.push(sellerId);
        p += 1;
      }
    }

    if (sport) {
      where += ` AND l.sport ILIKE $${p}`;
      params.push(`%${sport}%`);
      p += 1;
    }
    if (manufacturer) {
      where += ` AND l.manufacturer ILIKE $${p}`;
      params.push(`%${manufacturer}%`);
      p += 1;
    }
    if (team) {
      where += ` AND l.team ILIKE $${p}`;
      params.push(`%${team}%`);
      p += 1;
    }
    if (cardNumber) {
      where += ` AND l.card_number ILIKE $${p}`;
      params.push(`%${cardNumber}%`);
      p += 1;
    }
    if (conditionGrade) {
      where += ` AND l.condition_grade ILIKE $${p}`;
      params.push(`%${conditionGrade}%`);
      p += 1;
    }
    if (cardTypeRaw && ["BASE", "PARALLEL", "AUTO", "ROOKIE"].includes(cardTypeRaw)) {
      where += ` AND l.card_type = $${p}::card_type`;
      params.push(cardTypeRaw);
      p += 1;
    }

    const yf = parseIntSafe(req.query.year_from, NaN, 1800, 2100);
    if (Number.isFinite(yf)) {
      where += ` AND l.year >= $${p}`;
      params.push(yf);
      p += 1;
    }
    const yt = parseIntSafe(req.query.year_to, NaN, 1800, 2100);
    if (Number.isFinite(yt)) {
      where += ` AND l.year <= $${p}`;
      params.push(yt);
      p += 1;
    }

    const minEur = Number(String(req.query.min_price_eur || "").replace(",", "."));
    if (Number.isFinite(minEur) && minEur >= 0) {
      const cents = Math.round(minEur * 100);
      where += ` AND l.price_cents >= $${p}`;
      params.push(cents);
      p += 1;
    }
    const maxEur = Number(String(req.query.max_price_eur || "").replace(",", "."));
    if (Number.isFinite(maxEur) && maxEur >= 0) {
      const cents = Math.round(maxEur * 100);
      where += ` AND l.price_cents <= $${p}`;
      params.push(cents);
      p += 1;
    }

    if (searchText) {
      const like = `%${searchText}%`;
      where += ` AND (
        l.player_name ILIKE $${p} OR l.team ILIKE $${p + 1}
        OR l.description ILIKE $${p + 2} OR l.set_name ILIKE $${p + 3}
        OR l.manufacturer ILIKE $${p + 4}
      )`;
      params.push(like, like, like, like, like);
      p += 5;
    }

    const countSql = `SELECT COUNT(*)::int AS n FROM listing l WHERE ${where}`;
    const listSql = `
      SELECT l.*
      FROM listing l
      WHERE ${where}
      ORDER BY ${orderBy}
      LIMIT $${p} OFFSET $${p + 1}
    `;
    params.push(limit, offset);

    const [countResult, listResult] = await Promise.all([
      pool.query(countSql, params.slice(0, params.length - 2)),
      pool.query(listSql, params),
    ]);

    res.json({
      total: countResult.rows[0].n,
      listings: listResult.rows,
      limit,
      offset,
      private_market: privateOnly,
    });
  } catch (err) {
    next(err);
  }
});

/** GET /api/listings/mine — eigene Inserate */
router.get("/mine", authRequired, async (req, res, next) => {
  try {
    const limit = parseIntSafe(req.query.limit, 50, 1, 200);
    const offset = parseIntSafe(req.query.offset, 0, 0, 1_000_000);
    const r = await pool.query(
      `SELECT * FROM listing
       WHERE seller_id = $1
       ORDER BY updated_at DESC
       LIMIT $2 OFFSET $3`,
      [req.userId, limit, offset]
    );
    res.json({ listings: r.rows });
  } catch (err) {
    next(err);
  }
});

/** GET /api/listings/:id */
router.get("/:id", optionalAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      throw new HttpError(400, "Ungültige ID.");
    }
    const r = await pool.query(`SELECT * FROM listing WHERE id = $1`, [id]);
    const row = r.rows[0];
    if (!row) {
      throw new HttpError(404, "Inserat nicht gefunden.");
    }
    const uid = req.userId ? Number(req.userId) : null;
    const isOwner = uid != null && Number(row.seller_id) === uid;
    if (row.status !== "ACTIVE" && !isOwner) {
      throw new HttpError(404, "Inserat nicht gefunden.");
    }
    const canPrivate = await userHasPrivateMarketAccess(uid);
    if (row.is_private_market && !isOwner && !canPrivate) {
      throw new HttpError(404, "Inserat nicht gefunden.");
    }
    res.json({ listing: row });
  } catch (err) {
    next(err);
  }
});

function normalizeListingBody(body, partial) {
  const out = {};
  const fields = [
    "sport",
    "manufacturer",
    "set_name",
    "player_name",
    "team",
    "card_number",
    "description",
    "currency",
    "condition_grade",
  ];
  for (const k of fields) {
    if (partial && body[k] === undefined) {
      continue;
    }
    out[k] = String(body[k] ?? "").trim().slice(0, k === "description" ? 8000 : 500);
  }
  if (!partial || body.year !== undefined) {
    const y = Number(body.year);
    out.year = Number.isInteger(y) && y >= 1800 && y <= 2100 ? y : 0;
  }
  if (!partial || body.price_cents !== undefined) {
    const pc = Number(body.price_cents);
    out.price_cents =
      Number.isInteger(pc) && pc >= 0 && pc <= 1_000_000_000 ? pc : 0;
  }
  if (!partial || body.card_type !== undefined) {
    const ct = String(body.card_type || "BASE").toUpperCase();
    out.card_type = ["BASE", "PARALLEL", "AUTO", "ROOKIE"].includes(ct)
      ? ct
      : "BASE";
  }
  if (!partial || body.status !== undefined) {
    const st = String(body.status || "DRAFT").toUpperCase();
    if (!LISTING_STATUSES.has(st)) {
      throw new HttpError(400, "Ungültiger status.");
    }
    out.status = st;
  }
  if (!partial || body.is_private_market !== undefined) {
    out.is_private_market = Boolean(body.is_private_market);
  }
  return out;
}

/** POST /api/listings */
router.post("/", authRequired, async (req, res, next) => {
  try {
    const data = normalizeListingBody(req.body, false);
    if (data.is_private_market && !(await userHasPrivateMarketAccess(req.userId))) {
      throw new HttpError(403, "Private Market nur mit Freischaltung.");
    }
    const r = await pool.query(
      `INSERT INTO listing (
         seller_id, sport, manufacturer, set_name, year, player_name, team, card_number,
         card_type, condition_grade, price_cents, currency, description, status, is_private_market
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::card_type,$10,$11,$12,$13,$14::listing_status,$15)
       RETURNING *`,
      [
        req.userId,
        data.sport,
        data.manufacturer,
        data.set_name,
        data.year,
        data.player_name,
        data.team,
        data.card_number,
        data.card_type,
        data.condition_grade,
        data.price_cents,
        data.currency || "EUR",
        data.description,
        data.status,
        data.is_private_market,
      ]
    );
    const listing = r.rows[0];
    if (listing.status === "ACTIVE" && !listing.is_private_market) {
      fireAndNotifyNewListing(listing, { excludeUserId: req.userId });
    }
    res.status(201).json({ listing });
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/listings/:id */
router.patch("/:id", authRequired, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      throw new HttpError(400, "Ungültige ID.");
    }
    const cur = await pool.query(
      `SELECT * FROM listing WHERE id = $1 AND seller_id = $2`,
      [id, req.userId]
    );
    const row = cur.rows[0];
    if (!row) {
      throw new HttpError(404, "Inserat nicht gefunden.");
    }
    if (row.is_welcome_anchor) {
      throw new HttpError(403, "Anker-Inserat kann nicht bearbeitet werden.");
    }

    const data = normalizeListingBody(req.body, true);
    const merged = { ...row, ...data };
    if (merged.is_private_market && !(await userHasPrivateMarketAccess(req.userId))) {
      throw new HttpError(403, "Private Market nur mit Freischaltung.");
    }

    const r = await pool.query(
      `UPDATE listing SET
         sport = $1, manufacturer = $2, set_name = $3, year = $4,
         player_name = $5, team = $6, card_number = $7,
         card_type = $8::card_type, condition_grade = $9,
         price_cents = $10, currency = $11, description = $12,
         status = $13::listing_status,
         is_private_market = $14,
         updated_at = NOW()
       WHERE id = $15 AND seller_id = $16
       RETURNING *`,
      [
        merged.sport,
        merged.manufacturer,
        merged.set_name,
        merged.year,
        merged.player_name,
        merged.team,
        merged.card_number,
        merged.card_type,
        merged.condition_grade,
        merged.price_cents,
        merged.currency || "EUR",
        merged.description,
        merged.status,
        Boolean(merged.is_private_market),
        id,
        req.userId,
      ]
    );
    const listing = r.rows[0];
    if (listing.status === "ACTIVE" && !listing.is_private_market) {
      fireAndNotifyNewListing(listing, { excludeUserId: req.userId });
    }
    res.json({ listing });
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/listings/:id — archiviert */
router.delete("/:id", authRequired, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      throw new HttpError(400, "Ungültige ID.");
    }
    const cur = await pool.query(
      `SELECT * FROM listing WHERE id = $1 AND seller_id = $2`,
      [id, req.userId]
    );
    const row = cur.rows[0];
    if (!row) {
      throw new HttpError(404, "Inserat nicht gefunden.");
    }
    if (row.is_welcome_anchor) {
      throw new HttpError(403, "Anker-Inserat kann nicht gelöscht werden.");
    }
    await pool.query(
      `UPDATE listing SET status = 'ARCHIVED'::listing_status, updated_at = NOW()
       WHERE id = $1`,
      [id]
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
