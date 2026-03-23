const crypto = require("crypto");
const { query, withTransaction } = require("../db");
const { HttpError } = require("../utils/httpError");

function generateInviteCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 10; i += 1) {
    s += alphabet[crypto.randomInt(0, alphabet.length)];
  }
  return s;
}

function normalizeCode(raw) {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

/**
 * POST /api/private-market/redeem  (auth)
 * Body: { code: string }
 */
async function redeem(req, res, next) {
  try {
    const code = normalizeCode(req.body?.code);
    if (code.length < 4 || code.length > 32) {
      throw new HttpError(400, "Bitte einen gültigen Einladungscode eingeben.");
    }

    const uid = req.userId;

    const me = await query(
      `SELECT private_market_access FROM app_user WHERE id = $1`,
      [uid]
    );
    if (!me.rows[0]) {
      throw new HttpError(401, "Nicht angemeldet.");
    }
    if (me.rows[0].private_market_access) {
      res.json({ ok: true, already_member: true });
      return;
    }

    const prev = await query(
      `SELECT 1 FROM private_market_invite_redemption WHERE user_id = $1`,
      [uid]
    );
    if (prev.rows.length > 0) {
      throw new HttpError(
        400,
        "Du hast bereits eine Einladung eingelöst. Bei Fragen kontaktiere den Support."
      );
    }

    await withTransaction(async (client) => {
      const inv = await client.query(
        `SELECT id, max_redemptions, redemption_count, expires_at, revoked_at
         FROM private_market_invite
         WHERE code = $1
         FOR UPDATE`,
        [code]
      );
      const row = inv.rows[0];
      if (!row || row.revoked_at) {
        throw new HttpError(400, "Ungültiger oder widerrufener Code.");
      }
      if (row.expires_at && new Date(row.expires_at) < new Date()) {
        throw new HttpError(400, "Dieser Einladungscode ist abgelaufen.");
      }
      if (
        row.max_redemptions != null &&
        row.redemption_count >= row.max_redemptions
      ) {
        throw new HttpError(400, "Dieser Code wurde bereits vollständig eingelöst.");
      }

      await client.query(
        `INSERT INTO private_market_invite_redemption (invite_id, user_id)
         VALUES ($1, $2)`,
        [row.id, uid]
      );
      await client.query(
        `UPDATE private_market_invite
         SET redemption_count = redemption_count + 1
         WHERE id = $1`,
        [row.id]
      );
      await client.query(
        `UPDATE app_user
         SET private_market_access = TRUE, updated_at = NOW()
         WHERE id = $1`,
        [uid]
      );
    });

    res.json({ ok: true });
  } catch (err) {
    if (err && err.code === "23505") {
      next(
        new HttpError(
          400,
          "Du hast bereits eine Einladung eingelöst."
        )
      );
      return;
    }
    next(err);
  }
}

/**
 * GET /api/admin/private-market-invites
 */
async function adminList(req, res, next) {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const r = await query(
      `SELECT id, code, max_redemptions, redemption_count, expires_at,
              revoked_at, note, created_at, created_by_admin_id
       FROM private_market_invite
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );
    const rows = r.rows;
    if (rows.length === 0) {
      res.json({ invites: [] });
      return;
    }
    const ids = rows.map((x) => x.id);
    const red = await query(
      `SELECT r.invite_id, r.user_id, r.redeemed_at,
              u.email, u.display_name
       FROM private_market_invite_redemption r
       JOIN app_user u ON u.id = r.user_id
       WHERE r.invite_id = ANY($1::int[])
       ORDER BY r.redeemed_at DESC`,
      [ids]
    );
    const byInvite = {};
    for (const row of red.rows) {
      if (!byInvite[row.invite_id]) {
        byInvite[row.invite_id] = [];
      }
      byInvite[row.invite_id].push({
        user_id: row.user_id,
        email: row.email,
        display_name: row.display_name || "",
        redeemed_at: row.redeemed_at,
      });
    }
    const invites = rows.map((inv) => ({
      ...inv,
      redemptions: byInvite[inv.id] || [],
    }));
    res.json({ invites });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/admin/private-market-invites
 * Body: { max_redemptions?: number | null, expires_in_days?: number, note?: string }
 * Standard: max_redemptions = 1 (einmalig)
 */
async function adminCreate(req, res, next) {
  try {
    let maxRedemptions = 1;
    if (Object.prototype.hasOwnProperty.call(req.body, "max_redemptions")) {
      const v = req.body.max_redemptions;
      if (v === null || v === "") {
        maxRedemptions = null;
      } else {
        const n = Number(v);
        if (!Number.isInteger(n) || n < 1) {
          throw new HttpError(400, "max_redemptions muss eine positive Zahl sein oder null.");
        }
        maxRedemptions = n;
      }
    }

    let expiresAt = null;
    if (req.body.expires_in_days !== undefined && req.body.expires_in_days !== null) {
      const d = Number(req.body.expires_in_days);
      if (!Number.isInteger(d) || d < 1 || d > 3650) {
        throw new HttpError(400, "expires_in_days ungültig (1–3650).");
      }
      const dt = new Date();
      dt.setUTCDate(dt.getUTCDate() + d);
      expiresAt = dt.toISOString();
    }

    const note = String(req.body.note || "").trim().slice(0, 500);

    let code = "";
    for (let attempt = 0; attempt < 12; attempt += 1) {
      code = generateInviteCode();
      try {
        const ins = await query(
          `INSERT INTO private_market_invite (
             code, max_redemptions, expires_at, note, created_by_admin_id
           ) VALUES ($1, $2, $3, $4, $5)
           RETURNING id, code, max_redemptions, redemption_count, expires_at,
                     revoked_at, note, created_at`,
          [code, maxRedemptions, expiresAt, note, req.userId]
        );
        res.status(201).json({ invite: ins.rows[0] });
        return;
      } catch (e) {
        if (e && e.code === "23505") {
          continue;
        }
        throw e;
      }
    }
    throw new HttpError(500, "Code konnte nicht erzeugt werden.");
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/admin/private-market-invites/:id
 * Body: { revoked?: boolean }
 */
async function adminPatch(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      throw new HttpError(400, "Ungültige ID.");
    }
    if (req.body.revoked !== true) {
      throw new HttpError(400, "Nur revoked: true unterstützt.");
    }
    const r = await query(
      `UPDATE private_market_invite
       SET revoked_at = NOW()
       WHERE id = $1 AND revoked_at IS NULL
       RETURNING id, code, max_redemptions, redemption_count, expires_at, revoked_at, note, created_at`,
      [id]
    );
    if (r.rows.length === 0) {
      throw new HttpError(404, "Einladung nicht gefunden oder bereits widerrufen.");
    }
    res.json({ invite: r.rows[0] });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  redeem,
  adminList,
  adminCreate,
  adminPatch,
};
