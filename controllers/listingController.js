const { query } = require("../db");
const { HttpError } = require("../utils/httpError");
const { fireAndNotifyNewListing } = require("../services/expoPush");

const CARD_TYPES = new Set([
  "BASE",
  "NUMBERED",
  "AUTOGRAPH",
  "PATCH",
  "ROOKIE",
]);

function parseImageUrls(raw) {
  if (raw === undefined || raw === null) {
    return [];
  }
  if (!Array.isArray(raw)) {
    throw new HttpError(400, "image_urls muss ein Array sein.");
  }
  return raw.map((u) => String(u).trim()).filter(Boolean);
}

function assertCardType(v) {
  const t = String(v || "").toUpperCase();
  if (!CARD_TYPES.has(t)) {
    throw new HttpError(400, "Ungültiger Kartentyp.");
  }
  return t;
}

function stripListingMarketGuest(row, viewerId) {
  if (!row || viewerId) {
    return;
  }
  delete row.market_value_cents;
  delete row.market_value_source;
}

async function recordPriceHistory(listingId, priceCents) {
  await query(
    `INSERT INTO listing_price_history (listing_id, price_cents) VALUES ($1, $2)`,
    [listingId, priceCents]
  );
}

function parseSort(sortRaw) {
  const s = sortRaw ? String(sortRaw).trim() : "";
  if (s === "price_asc") {
    return "l.price_cents ASC, l.updated_at DESC";
  }
  if (s === "price_desc") {
    return "l.price_cents DESC, l.updated_at DESC";
  }
  if (s === "year_desc") {
    return "l.year DESC, l.updated_at DESC";
  }
  if (s === "year_asc") {
    return "l.year ASC, l.updated_at DESC";
  }
  return "l.updated_at DESC";
}

async function list(req, res, next) {
  try {
    const limit = Math.min(
      100,
      Math.max(1, Number(req.query.limit) || 20)
    );
    const offset = Math.max(0, Number(req.query.offset) || 0);

    const sport = req.query.sport ? String(req.query.sport).trim() : "";
    const manufacturer = req.query.manufacturer
      ? String(req.query.manufacturer).trim()
      : "";
    const setName = req.query.set_name ? String(req.query.set_name).trim() : "";
    const team = req.query.team ? String(req.query.team).trim() : "";
    const cardNumber = req.query.card_number
      ? String(req.query.card_number).trim()
      : "";
    const search = req.query.search ? String(req.query.search).trim() : "";
    const cardType = req.query.card_type
      ? String(req.query.card_type).toUpperCase()
      : "";
    const conditionGrade = req.query.condition_grade
      ? String(req.query.condition_grade).trim()
      : "";
    const yearFrom =
      req.query.year_from !== undefined ? Number(req.query.year_from) : null;
    const yearTo =
      req.query.year_to !== undefined ? Number(req.query.year_to) : null;

    const hasMinEur =
      req.query.min_price_eur !== undefined &&
      String(req.query.min_price_eur).trim() !== "";
    const hasMaxEur =
      req.query.max_price_eur !== undefined &&
      String(req.query.max_price_eur).trim() !== "";

    const minPriceCents =
      req.query.min_price !== undefined ? Number(req.query.min_price) : null;
    const maxPriceCents =
      req.query.max_price !== undefined ? Number(req.query.max_price) : null;

    const sellerId =
      req.query.seller_id !== undefined
        ? Number(req.query.seller_id)
        : null;

    const orderBy = parseSort(req.query.sort);

    const conditions = [`l.status = 'ACTIVE'`];
    const params = [];
    let i = 1;

    if (sport) {
      conditions.push(`l.sport ILIKE $${i++}`);
      params.push(`%${sport}%`);
    }
    if (manufacturer) {
      conditions.push(`l.manufacturer ILIKE $${i++}`);
      params.push(`%${manufacturer}%`);
    }
    if (setName) {
      conditions.push(`l.set_name ILIKE $${i++}`);
      params.push(`%${setName}%`);
    }
    if (team) {
      conditions.push(`l.team ILIKE $${i++}`);
      params.push(`%${team}%`);
    }
    if (cardNumber) {
      conditions.push(`l.card_number ILIKE $${i++}`);
      params.push(`%${cardNumber}%`);
    }
    if (search) {
      conditions.push(
        `(l.player_name ILIKE $${i} OR l.team ILIKE $${i} OR l.description ILIKE $${i})`
      );
      params.push(`%${search}%`);
      i += 1;
    }
    if (cardType) {
      if (!CARD_TYPES.has(cardType)) {
        throw new HttpError(400, "Ungültiger Kartentyp.");
      }
      conditions.push(`l.card_type = $${i++}::card_type`);
      params.push(cardType);
    }
    if (conditionGrade) {
      conditions.push(`l.condition_grade ILIKE $${i++}`);
      params.push(`%${conditionGrade}%`);
    }
    if (yearFrom !== null && !Number.isNaN(yearFrom)) {
      conditions.push(`l.year >= $${i++}`);
      params.push(yearFrom);
    }
    if (yearTo !== null && !Number.isNaN(yearTo)) {
      conditions.push(`l.year <= $${i++}`);
      params.push(yearTo);
    }

    if (hasMinEur) {
      const v = Number(req.query.min_price_eur);
      if (!Number.isNaN(v) && v >= 0) {
        conditions.push(`l.price_cents >= $${i++}`);
        params.push(Math.round(v * 100));
      }
    } else if (minPriceCents !== null && !Number.isNaN(minPriceCents)) {
      conditions.push(`l.price_cents >= $${i++}`);
      params.push(Math.round(minPriceCents));
    }

    if (hasMaxEur) {
      const v = Number(req.query.max_price_eur);
      if (!Number.isNaN(v) && v >= 0) {
        conditions.push(`l.price_cents <= $${i++}`);
        params.push(Math.round(v * 100));
      }
    } else if (maxPriceCents !== null && !Number.isNaN(maxPriceCents)) {
      conditions.push(`l.price_cents <= $${i++}`);
      params.push(Math.round(maxPriceCents));
    }

    if (sellerId !== null && !Number.isNaN(sellerId) && sellerId >= 1) {
      conditions.push(`l.seller_id = $${i++}`);
      params.push(sellerId);
    }

    params.push(limit);
    const limitIdx = i++;
    params.push(offset);
    const offsetIdx = i++;

    const sql = `
      SELECT
        l.id,
        l.seller_id,
        l.sport,
        l.manufacturer,
        l.set_name,
        l.year,
        l.player_name,
        l.team,
        l.card_number,
        l.card_type,
        l.condition_grade,
        l.price_cents,
        l.currency,
        l.description,
        l.image_urls,
        l.status,
        l.is_graded,
        l.grading_company,
        l.grading_grade,
        l.shipping_included,
        l.shipping_cost_cents,
        l.market_value_cents,
        l.market_value_source,
        l.created_at,
        l.updated_at,
        u.display_name AS seller_display_name
      FROM listing l
      JOIN app_user u ON u.id = l.seller_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY ${orderBy}
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

    const countSql = `
      SELECT COUNT(*)::int AS c
      FROM listing l
      WHERE ${conditions.join(" AND ")}
    `;

    const [listRes, countRes] = await Promise.all([
      query(sql, params),
      query(countSql, params.slice(0, params.length - 2)),
    ]);

    const rows = listRes.rows;
    const viewerId = req.userId;
    if (viewerId && rows.length > 0) {
      const ids = rows.map((r) => r.id);
      const favRes = await query(
        `SELECT listing_id FROM favorite
         WHERE user_id = $1 AND listing_id = ANY($2::int[])`,
        [viewerId, ids]
      );
      const favSet = new Set(favRes.rows.map((r) => r.listing_id));
      rows.forEach((r) => {
        r.is_favorited = favSet.has(r.id);
      });
    } else {
      rows.forEach((r) => {
        r.is_favorited = false;
      });
    }

    rows.forEach((r) => stripListingMarketGuest(r, viewerId));

    res.json({
      listings: rows,
      total: countRes.rows[0].c,
      limit,
      offset,
    });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      throw new HttpError(400, "Ungültige ID.");
    }

    const viewer = req.userId !== null && req.userId !== undefined
      ? req.userId
      : null;

    const result = await query(
      `SELECT
         l.*,
         u.display_name AS seller_display_name,
         ($2::int IS NOT NULL AND EXISTS (
           SELECT 1 FROM favorite fav
           WHERE fav.listing_id = l.id AND fav.user_id = $2::int
         )) AS is_favorited
       FROM listing l
       JOIN app_user u ON u.id = l.seller_id
       WHERE l.id = $1`,
      [id, viewer]
    );
    const row = result.rows[0];
    if (!row) {
      throw new HttpError(404, "Listing nicht gefunden.");
    }

    const isOwner = viewer !== null && viewer === row.seller_id;
    if (row.status !== "ACTIVE" && !isOwner) {
      throw new HttpError(404, "Listing nicht gefunden.");
    }

    stripListingMarketGuest(row, viewer);

    res.json({ listing: row });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const sport = String(req.body.sport || "").trim();
    const manufacturer = String(req.body.manufacturer || "").trim();
    const setName = String(req.body.set_name || "").trim();
    const year = Number(req.body.year);
    const playerName = String(req.body.player_name || "").trim();
    const team = String(req.body.team || "").trim();
    const cardNumber = String(req.body.card_number || "").trim();
    const cardType = assertCardType(req.body.card_type);
    const conditionGrade = String(req.body.condition_grade || "").trim();
    const priceCents = Number(req.body.price_cents);
    const currency = String(req.body.currency || "EUR").trim().toUpperCase() || "EUR";
    const description = String(req.body.description || "");
    const imageUrls = parseImageUrls(req.body.image_urls);
    const status = req.body.status === "DRAFT" ? "DRAFT" : "ACTIVE";

    if (!sport || !manufacturer || !playerName || !conditionGrade) {
      throw new HttpError(
        400,
        "sport, manufacturer, player_name, condition_grade sind Pflichtfelder."
      );
    }
    if (!Number.isInteger(year) || year < 1800 || year > 2100) {
      throw new HttpError(400, "Ungültiges Jahr.");
    }
    if (!Number.isInteger(priceCents) || priceCents < 0) {
      throw new HttpError(400, "Ungültiger Preis (price_cents).");
    }

    const isGraded = Boolean(req.body.is_graded);
    const gradingCompany = String(req.body.grading_company || "").trim().slice(0, 32);
    const gradingGrade = String(req.body.grading_grade || "").trim().slice(0, 32);
    const shippingIncluded = Boolean(req.body.shipping_included);
    let shippingCostCents = null;
    if (
      req.body.shipping_cost_cents !== undefined &&
      req.body.shipping_cost_cents !== null &&
      String(req.body.shipping_cost_cents).trim() !== ""
    ) {
      const sc = Number(req.body.shipping_cost_cents);
      if (!Number.isInteger(sc) || sc < 0) {
        throw new HttpError(400, "Ungültige Versandkosten.");
      }
      shippingCostCents = sc;
    }
    let marketValueCents = null;
    if (
      req.body.market_value_cents !== undefined &&
      req.body.market_value_cents !== null &&
      String(req.body.market_value_cents).trim() !== ""
    ) {
      const mv = Number(req.body.market_value_cents);
      if (!Number.isInteger(mv) || mv < 0) {
        throw new HttpError(400, "Ungültiger Marktwert.");
      }
      marketValueCents = mv;
    }
    const marketValueSource = String(req.body.market_value_source || "")
      .trim()
      .slice(0, 64);

    const result = await query(
      `INSERT INTO listing (
         seller_id, sport, manufacturer, set_name, year, player_name, team,
         card_number, card_type, condition_grade, price_cents, currency,
         description, image_urls, status,
         is_graded, grading_company, grading_grade,
         shipping_included, shipping_cost_cents,
         market_value_cents, market_value_source
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9::card_type, $10, $11, $12, $13, $14::jsonb, $15::listing_status,
         $16, $17, $18, $19, $20, $21, $22
       )
       RETURNING *`,
      [
        req.userId,
        sport,
        manufacturer,
        setName,
        year,
        playerName,
        team,
        cardNumber,
        cardType,
        conditionGrade,
        priceCents,
        currency,
        description,
        JSON.stringify(imageUrls),
        status,
        isGraded,
        gradingCompany,
        gradingGrade,
        shippingIncluded,
        shippingCostCents,
        marketValueCents,
        marketValueSource,
      ]
    );

    const created = result.rows[0];
    await recordPriceHistory(created.id, created.price_cents);
    if (created.status === "ACTIVE") {
      fireAndNotifyNewListing(created, { excludeUserId: req.userId });
    }

    res.status(201).json({ listing: created });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      throw new HttpError(400, "Ungültige ID.");
    }

    const existing = await query(
      `SELECT seller_id, status AS old_status, price_cents AS old_price FROM listing WHERE id = $1`,
      [id]
    );
    const row = existing.rows[0];
    if (!row) {
      throw new HttpError(404, "Listing nicht gefunden.");
    }
    if (row.seller_id !== req.userId) {
      throw new HttpError(403, "Keine Berechtigung.");
    }
    const oldStatus = row.old_status;
    const oldPrice = row.old_price;

    const updates = [];
    const params = [];
    let i = 1;

    const map = [
      ["sport", "sport"],
      ["manufacturer", "manufacturer"],
      ["set_name", "set_name"],
      ["year", "year"],
      ["player_name", "player_name"],
      ["team", "team"],
      ["card_number", "card_number"],
      ["condition_grade", "condition_grade"],
      ["description", "description"],
      ["currency", "currency"],
      ["price_cents", "price_cents"],
    ];

    for (const [key, col] of map) {
      if (req.body[key] !== undefined) {
        updates.push(`${col} = $${i++}`);
        if (key === "year") {
          const y = Number(req.body.year);
          if (!Number.isInteger(y) || y < 1800 || y > 2100) {
            throw new HttpError(400, "Ungültiges Jahr.");
          }
          params.push(y);
        } else if (key === "price_cents") {
          const p = Number(req.body.price_cents);
          if (!Number.isInteger(p) || p < 0) {
            throw new HttpError(400, "Ungültiger Preis.");
          }
          params.push(p);
        } else if (key === "currency") {
          params.push(String(req.body.currency).trim().toUpperCase() || "EUR");
        } else {
          params.push(String(req.body[key]));
        }
      }
    }

    if (req.body.card_type !== undefined) {
      updates.push(`card_type = $${i++}::card_type`);
      params.push(assertCardType(req.body.card_type));
    }

    if (req.body.image_urls !== undefined) {
      updates.push(`image_urls = $${i++}::jsonb`);
      params.push(JSON.stringify(parseImageUrls(req.body.image_urls)));
    }

    if (req.body.status !== undefined) {
      const s = String(req.body.status).toUpperCase();
      if (!["DRAFT", "ACTIVE", "SOLD", "ARCHIVED"].includes(s)) {
        throw new HttpError(400, "Ungültiger Status.");
      }
      updates.push(`status = $${i++}::listing_status`);
      params.push(s);
    }

    if (req.body.is_graded !== undefined) {
      updates.push(`is_graded = $${i++}`);
      params.push(Boolean(req.body.is_graded));
    }
    if (req.body.grading_company !== undefined) {
      updates.push(`grading_company = $${i++}`);
      params.push(String(req.body.grading_company).trim().slice(0, 32));
    }
    if (req.body.grading_grade !== undefined) {
      updates.push(`grading_grade = $${i++}`);
      params.push(String(req.body.grading_grade).trim().slice(0, 32));
    }
    if (req.body.shipping_included !== undefined) {
      updates.push(`shipping_included = $${i++}`);
      params.push(Boolean(req.body.shipping_included));
    }
    if (req.body.shipping_cost_cents !== undefined) {
      const raw = req.body.shipping_cost_cents;
      if (raw === null || String(raw).trim() === "") {
        updates.push(`shipping_cost_cents = $${i++}`);
        params.push(null);
      } else {
        const sc = Number(raw);
        if (!Number.isInteger(sc) || sc < 0) {
          throw new HttpError(400, "Ungültige Versandkosten.");
        }
        updates.push(`shipping_cost_cents = $${i++}`);
        params.push(sc);
      }
    }
    if (req.body.market_value_cents !== undefined) {
      const raw = req.body.market_value_cents;
      if (raw === null || String(raw).trim() === "") {
        updates.push(`market_value_cents = $${i++}`);
        params.push(null);
      } else {
        const mv = Number(raw);
        if (!Number.isInteger(mv) || mv < 0) {
          throw new HttpError(400, "Ungültiger Marktwert.");
        }
        updates.push(`market_value_cents = $${i++}`);
        params.push(mv);
      }
    }
    if (req.body.market_value_source !== undefined) {
      updates.push(`market_value_source = $${i++}`);
      params.push(String(req.body.market_value_source).trim().slice(0, 64));
    }

    if (updates.length === 0) {
      throw new HttpError(400, "Keine Felder zum Aktualisieren.");
    }

    updates.push(`updated_at = NOW()`);
    params.push(id);

    const sql = `
      UPDATE listing SET ${updates.join(", ")}
      WHERE id = $${i}
      RETURNING *
    `;
    const result = await query(sql, params);
    const updated = result.rows[0];
    if (updated && updated.price_cents !== oldPrice) {
      await recordPriceHistory(id, updated.price_cents);
    }
    if (
      updated &&
      updated.status === "ACTIVE" &&
      oldStatus !== "ACTIVE"
    ) {
      fireAndNotifyNewListing(updated, { excludeUserId: req.userId });
    }
    res.json({ listing: updated });
  } catch (err) {
    next(err);
  }
}

async function archive(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      throw new HttpError(400, "Ungültige ID.");
    }

    const result = await query(
      `UPDATE listing
       SET status = 'ARCHIVED', updated_at = NOW()
       WHERE id = $1 AND seller_id = $2
       RETURNING *`,
      [id, req.userId]
    );
    if (result.rowCount === 0) {
      throw new HttpError(404, "Listing nicht gefunden oder keine Berechtigung.");
    }
    res.json({ listing: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  getById,
  create,
  update,
  archive,
  CARD_TYPES,
};
