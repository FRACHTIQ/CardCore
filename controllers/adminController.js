const { query, withTransaction } = require("../db");
const { HttpError } = require("../utils/httpError");
const { sendWelcomeDmToNewUser } = require("../services/welcomeDm");

const BODY_MAX = 8000;

function clip(s, max) {
  return String(s ?? "")
    .trim()
    .slice(0, max);
}

async function dashboard(req, res, next) {
  try {
    const [
      users,
      usersVerified,
      listingsActive,
      listingsSold,
      supportOpen,
      supportTotal,
      revenue,
    ] = await Promise.all([
      query(`SELECT COUNT(*)::int AS c FROM app_user`),
      query(
        `SELECT COUNT(*)::int AS c FROM app_user WHERE is_verified = TRUE`
      ),
      query(`SELECT COUNT(*)::int AS c FROM listing WHERE status = 'ACTIVE'`),
      query(`SELECT COUNT(*)::int AS c FROM listing WHERE status = 'SOLD'`),
      query(
        `SELECT COUNT(*)::int AS c FROM support_ticket WHERE status IN ('OPEN','WAITING_STAFF')`
      ),
      query(`SELECT COUNT(*)::int AS c FROM support_ticket`),
      query(
        `SELECT COALESCE(SUM(price_cents), 0)::bigint AS cents
         FROM listing WHERE status = 'SOLD'`
      ),
    ]);

    const revenueActive = await query(
      `SELECT COALESCE(SUM(price_cents), 0)::bigint AS cents
       FROM listing WHERE status = 'ACTIVE'`
    );

    /** Ohne Migration 013 (user_report) soll das Dashboard nicht komplett ausfallen. */
    let reportsOpen = null;
    try {
      const rr = await query(
        `SELECT COUNT(*)::int AS c FROM user_report WHERE lower(trim(status)) = 'open'`
      );
      reportsOpen = rr.rows[0].c;
    } catch (e) {
      if (e && (e.code === "42P01" || e.code === "42703")) {
        reportsOpen = null;
      } else {
        throw e;
      }
    }

    res.json({
      users_total: users.rows[0].c,
      users_verified: usersVerified.rows[0].c,
      listings_active: listingsActive.rows[0].c,
      listings_sold: listingsSold.rows[0].c,
      inventory_value_active_cents: Number(revenueActive.rows[0].c),
      revenue_sold_cents: Number(revenue.rows[0].c),
      support_open: supportOpen.rows[0].c,
      support_tickets_total: supportTotal.rows[0].c,
      reports_open: reportsOpen,
    });
  } catch (err) {
    next(err);
  }
}

async function revenueDetail(req, res, next) {
  try {
    const byStatus = await query(
      `SELECT status::text, COUNT(*)::int AS c, COALESCE(SUM(price_cents),0)::bigint AS total_cents
       FROM listing GROUP BY status ORDER BY status`
    );
    res.json({ by_status: byStatus.rows });
  } catch (err) {
    next(err);
  }
}

async function listUsers(req, res, next) {
  try {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const search = req.query.search ? String(req.query.search).trim() : "";

    const conditions = [];
    const params = [];
    let i = 1;
    if (search) {
      conditions.push(
        `(u.email ILIKE $${i} OR u.display_name ILIKE $${i})`
      );
      params.push(`%${search}%`);
      i++;
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const countSql = `SELECT COUNT(*)::int AS c FROM app_user u ${where}`;
    const listSql = `
      SELECT u.id, u.email, u.display_name, u.role, u.is_verified,
        u.suspended_at, u.created_at,
        (LENGTH(u.avatar_url) > 0) AS has_avatar,
        (SELECT COUNT(*)::int FROM listing l WHERE l.seller_id = u.id AND l.status = 'ACTIVE') AS active_listings,
        (SELECT COUNT(*)::int FROM listing l WHERE l.seller_id = u.id AND l.status = 'SOLD') AS sold_listings
      FROM app_user u
      ${where}
      ORDER BY u.created_at DESC
      LIMIT $${i} OFFSET $${i + 1}`;
    params.push(limit, offset);

    const [totalR, rowsR] = await Promise.all([
      query(countSql, params.slice(0, params.length - 2)),
      query(listSql, params),
    ]);

    res.json({
      total: totalR.rows[0].c,
      limit,
      offset,
      users: rowsR.rows,
    });
  } catch (err) {
    next(err);
  }
}

async function getUser(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      throw new HttpError(400, "Ungültige ID.");
    }
    const r = await query(
      `SELECT id, email, display_name, bio, role, is_verified, verification_note,
        suspended_at, legal_name, phone, street, address_extra, postal_code, city, country,
        created_at, updated_at,
        (LENGTH(avatar_url) > 0) AS has_avatar,
        avatar_url
       FROM app_user WHERE id = $1`,
      [id]
    );
    const u = r.rows[0];
    if (!u) {
      throw new HttpError(404, "Benutzer nicht gefunden.");
    }
    const stats = await query(
      `SELECT
         COALESCE((SELECT COUNT(*)::int FROM listing l WHERE l.seller_id = $1 AND l.status = 'ACTIVE'), 0) AS active_listings,
         COALESCE((SELECT COUNT(*)::int FROM listing l WHERE l.seller_id = $1 AND l.status = 'SOLD'), 0) AS sold_listings,
         COALESCE((SELECT COUNT(*)::int FROM listing l WHERE l.seller_id = $1), 0) AS total_listings`,
      [id]
    );
    res.json({ user: u, stats: stats.rows[0] });
  } catch (err) {
    next(err);
  }
}

async function patchUser(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      throw new HttpError(400, "Ungültige ID.");
    }
    if (id === req.userId) {
      throw new HttpError(400, "Eigenes Konto hier nicht über dieses Formular ändern.");
    }

    const isVerified =
      req.body.is_verified !== undefined
        ? Boolean(req.body.is_verified)
        : null;
    const verificationNote =
      req.body.verification_note !== undefined
        ? clip(req.body.verification_note, 2000)
        : null;
    const role =
      req.body.role !== undefined ? String(req.body.role).trim() : null;
    const suspended =
      req.body.suspended !== undefined ? Boolean(req.body.suspended) : null;

    if (role !== null && role !== "user" && role !== "admin") {
      throw new HttpError(400, "Ungültige Rolle.");
    }

    if (role === "user") {
      const current = await query(`SELECT role FROM app_user WHERE id = $1`, [
        id,
      ]);
      if (current.rows[0]?.role === "admin") {
        const otherAdmins = await query(
          `SELECT COUNT(*)::int AS c FROM app_user WHERE role = 'admin' AND id <> $1`,
          [id]
        );
        if (otherAdmins.rows[0].c < 1) {
          throw new HttpError(400, "Letzter Admin kann nicht entfernt werden.");
        }
      }
    }

    const fields = [];
    const values = [];
    let i = 1;

    if (isVerified !== null) {
      fields.push(`is_verified = $${i++}`);
      values.push(isVerified);
    }
    if (verificationNote !== null) {
      fields.push(`verification_note = $${i++}`);
      values.push(verificationNote);
    }
    if (role !== null) {
      fields.push(`role = $${i++}`);
      values.push(role);
    }
    if (suspended !== null) {
      fields.push(`suspended_at = $${i++}`);
      values.push(suspended ? new Date().toISOString() : null);
    }

    if (fields.length === 0) {
      throw new HttpError(400, "Keine Felder.");
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const sql = `
      UPDATE app_user SET ${fields.join(", ")}
      WHERE id = $${i}
      RETURNING id, email, display_name, role, is_verified, verification_note, suspended_at, updated_at`;
    const result = await query(sql, values);
    res.json({ user: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

async function listListings(req, res, next) {
  try {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const status = req.query.status;
    const search = req.query.search ? String(req.query.search).trim() : "";

    const conditions = [];
    const params = [];
    let i = 1;

    if (status && ["DRAFT", "ACTIVE", "SOLD", "ARCHIVED"].includes(status)) {
      conditions.push(`l.status = $${i++}`);
      params.push(status);
    }
    if (search) {
      conditions.push(
        `(l.player_name ILIKE $${i} OR l.manufacturer ILIKE $${i} OR u.email ILIKE $${i})`
      );
      params.push(`%${search}%`);
      i++;
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const countSql = `
      SELECT COUNT(*)::int AS c FROM listing l
      JOIN app_user u ON u.id = l.seller_id
      ${where}`;
    const listSql = `
      SELECT l.id, l.seller_id, l.sport, l.manufacturer, l.player_name, l.year,
        l.card_type::text, l.condition_grade, l.price_cents, l.currency, l.status::text,
        l.created_at, l.updated_at,
        u.email AS seller_email, u.display_name AS seller_display_name
      FROM listing l
      JOIN app_user u ON u.id = l.seller_id
      ${where}
      ORDER BY l.updated_at DESC
      LIMIT $${i} OFFSET $${i + 1}`;
    params.push(limit, offset);

    const [totalR, rowsR] = await Promise.all([
      query(countSql, params.slice(0, params.length - 2)),
      query(listSql, params),
    ]);

    res.json({
      total: totalR.rows[0].c,
      limit,
      offset,
      listings: rowsR.rows,
    });
  } catch (err) {
    next(err);
  }
}

async function getListing(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      throw new HttpError(400, "Ungültige ID.");
    }
    const r = await query(
      `SELECT l.*, u.email AS seller_email, u.display_name AS seller_display_name
       FROM listing l
       JOIN app_user u ON u.id = l.seller_id
       WHERE l.id = $1`,
      [id]
    );
    const row = r.rows[0];
    if (!row) {
      throw new HttpError(404, "Listing nicht gefunden.");
    }
    res.json({ listing: row });
  } catch (err) {
    next(err);
  }
}

async function patchListing(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      throw new HttpError(400, "Ungültige ID.");
    }
    const status = req.body.status;
    if (
      status === undefined ||
      !["DRAFT", "ACTIVE", "SOLD", "ARCHIVED"].includes(status)
    ) {
      throw new HttpError(400, "Ungültiger Status.");
    }
    const result = await query(
      `UPDATE listing SET status = $1::listing_status, updated_at = NOW()
       WHERE id = $2
       RETURNING id, status`,
      [status, id]
    );
    if (!result.rows[0]) {
      throw new HttpError(404, "Listing nicht gefunden.");
    }
    res.json({ listing: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

async function listSupportTickets(req, res, next) {
  try {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const status = req.query.status;

    const conditions = [];
    const params = [];
    let i = 1;
    if (status && ["OPEN", "WAITING_STAFF", "ANSWERED", "CLOSED"].includes(status)) {
      conditions.push(`t.status = $${i++}`);
      params.push(status);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const countSql = `SELECT COUNT(*)::int AS c FROM support_ticket t ${where}`;
    const listSql = `
      SELECT t.id, t.user_id, t.subject, t.status::text, t.created_at, t.updated_at,
        u.email AS user_email,
        (SELECT body FROM support_message m WHERE m.ticket_id = t.id ORDER BY m.created_at DESC LIMIT 1) AS last_preview
      FROM support_ticket t
      JOIN app_user u ON u.id = t.user_id
      ${where}
      ORDER BY t.updated_at DESC
      LIMIT $${i} OFFSET $${i + 1}`;
    params.push(limit, offset);

    const [totalR, rowsR] = await Promise.all([
      query(countSql, params.slice(0, params.length - 2)),
      query(listSql, params),
    ]);

    res.json({
      total: totalR.rows[0].c,
      limit,
      offset,
      tickets: rowsR.rows,
    });
  } catch (err) {
    next(err);
  }
}

async function getSupportTicket(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      throw new HttpError(400, "Ungültige Ticket-ID.");
    }
    const tRes = await query(
      `SELECT t.*, u.email AS user_email, u.display_name AS user_display_name
       FROM support_ticket t
       JOIN app_user u ON u.id = t.user_id
       WHERE t.id = $1`,
      [id]
    );
    const ticket = tRes.rows[0];
    if (!ticket) {
      throw new HttpError(404, "Ticket nicht gefunden.");
    }
    const mRes = await query(
      `SELECT id, from_user, body, created_at
       FROM support_message WHERE ticket_id = $1 ORDER BY created_at ASC`,
      [id]
    );
    res.json({ ticket, messages: mRes.rows });
  } catch (err) {
    next(err);
  }
}

async function postSupportReply(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      throw new HttpError(400, "Ungültige Ticket-ID.");
    }
    const body = clip(req.body.body, BODY_MAX);
    if (!body) {
      throw new HttpError(400, "Nachricht erforderlich.");
    }

    const check = await query(`SELECT id FROM support_ticket WHERE id = $1`, [id]);
    if (!check.rows[0]) {
      throw new HttpError(404, "Ticket nicht gefunden.");
    }

    await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO support_message (ticket_id, from_user, body)
         VALUES ($1, FALSE, $2)`,
        [id, body]
      );
      await client.query(
        `UPDATE support_ticket SET status = 'ANSWERED', updated_at = NOW() WHERE id = $1`,
        [id]
      );
    });

    const mRes = await query(
      `SELECT id, from_user, body, created_at
       FROM support_message WHERE ticket_id = $1 ORDER BY created_at ASC`,
      [id]
    );
    res.json({ messages: mRes.rows });
  } catch (err) {
    next(err);
  }
}

async function patchSupportTicket(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      throw new HttpError(400, "Ungültige Ticket-ID.");
    }
    const status = req.body.status;
    if (
      status === undefined ||
      !["OPEN", "WAITING_STAFF", "ANSWERED", "CLOSED"].includes(status)
    ) {
      throw new HttpError(400, "Ungültiger Status.");
    }
    const result = await query(
      `UPDATE support_ticket SET status = $1::support_ticket_status, updated_at = NOW()
       WHERE id = $2
       RETURNING id, status`,
      [status, id]
    );
    if (!result.rows[0]) {
      throw new HttpError(404, "Ticket nicht gefunden.");
    }
    res.json({ ticket: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

const REPORT_STATUSES = new Set(["open", "reviewed", "dismissed"]);

async function listUserReports(req, res, next) {
  try {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const raw = req.query.status ? String(req.query.status).trim().toLowerCase() : "";
    const statusFilter = raw === "" || raw === "all" ? null : raw;
    if (statusFilter && !REPORT_STATUSES.has(statusFilter)) {
      throw new HttpError(400, "Ungültiger Status-Filter.");
    }

    const params = [];
    let where = "";
    let i = 1;
    if (statusFilter) {
      where = `WHERE lower(trim(r.status)) = $${i++}`;
      params.push(statusFilter);
    }

    const countRes = await query(
      `SELECT COUNT(*)::int AS c FROM user_report r ${where}`,
      params
    );
    const listParams = [...params, limit, offset];
    const listSql = `
      SELECT
        r.id,
        r.reporter_id,
        r.reported_id,
        r.reason,
        r.details,
        r.status,
        r.created_at,
        rep.email AS reporter_email,
        rep.display_name AS reporter_display_name,
        tgt.email AS reported_email,
        tgt.display_name AS reported_display_name
      FROM user_report r
      JOIN app_user rep ON rep.id = r.reporter_id
      JOIN app_user tgt ON tgt.id = r.reported_id
      ${where}
      ORDER BY r.created_at DESC
      LIMIT $${i} OFFSET $${i + 1}`;
    const listRes = await query(listSql, listParams);

    res.json({
      total: countRes.rows[0].c,
      reports: listRes.rows,
    });
  } catch (err) {
    if (err && err.code === "42P01") {
      res.json({ total: 0, reports: [] });
      return;
    }
    next(err);
  }
}

async function getUserReport(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      throw new HttpError(400, "Ungültige ID.");
    }
    const result = await query(
      `SELECT
         r.id,
         r.reporter_id,
         r.reported_id,
         r.reason,
         r.details,
         r.status,
         r.created_at,
         rep.email AS reporter_email,
         rep.display_name AS reporter_display_name,
         tgt.email AS reported_email,
         tgt.display_name AS reported_display_name
       FROM user_report r
       JOIN app_user rep ON rep.id = r.reporter_id
       JOIN app_user tgt ON tgt.id = r.reported_id
       WHERE r.id = $1`,
      [id]
    );
    const row = result.rows[0];
    if (!row) {
      throw new HttpError(404, "Meldung nicht gefunden.");
    }
    res.json({ report: row });
  } catch (err) {
    next(err);
  }
}

async function patchUserReport(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      throw new HttpError(400, "Ungültige ID.");
    }
    const status = req.body.status !== undefined
      ? String(req.body.status).trim().toLowerCase()
      : null;
    if (!status || !REPORT_STATUSES.has(status)) {
      throw new HttpError(400, "Gültiger status erforderlich (open, reviewed, dismissed).");
    }
    const result = await query(
      `UPDATE user_report SET status = $1 WHERE id = $2
       RETURNING id, status, reason, details, reporter_id, reported_id, created_at`,
      [status, id]
    );
    const row = result.rows[0];
    if (!row) {
      throw new HttpError(404, "Meldung nicht gefunden.");
    }
    res.json({ report: row });
  } catch (err) {
    next(err);
  }
}

/** Willkommens-DM für einen User nachträglich auslösen (läuft auf dem Server, z. B. Railway). */
async function postWelcomeDm(req, res, next) {
  try {
    const userId = Number(req.body.user_id);
    if (!Number.isInteger(userId) || userId < 1) {
      throw new HttpError(400, "user_id erforderlich (positive Ganzzahl).");
    }
    const welcome_dm = await sendWelcomeDmToNewUser(userId);
    res.json({ welcome_dm });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  dashboard,
  revenueDetail,
  listUsers,
  getUser,
  patchUser,
  listListings,
  getListing,
  patchListing,
  listSupportTickets,
  getSupportTicket,
  postSupportReply,
  patchSupportTicket,
  listUserReports,
  getUserReport,
  patchUserReport,
  postWelcomeDm,
};
