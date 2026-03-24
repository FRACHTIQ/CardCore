const { query } = require("../db");
const { HttpError } = require("../utils/httpError");

function clip(s, max) {
  return String(s ?? "")
    .trim()
    .slice(0, max);
}

const DEFAULT_ROW = {
  min_native_version: "1.0.0",
  maintenance_enabled: false,
  maintenance_message: "",
  partner_name: "",
  partner_url: "",
};

function normalizeOptionalUrl(s) {
  const raw = String(s ?? "").trim();
  if (!raw) {
    return "";
  }
  if (!/^https?:\/\//i.test(raw)) {
    throw new HttpError(400, "partner_url muss mit http:// oder https:// beginnen.");
  }
  try {
    const u = new URL(raw);
    return u.toString().slice(0, 2048);
  } catch {
    throw new HttpError(400, "partner_url ist ungültig.");
  }
}

async function ensureRow() {
  await query(
    `INSERT INTO app_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING`
  );
}

async function readRow() {
  const r = await query(
    `SELECT min_native_version, maintenance_enabled, maintenance_message, partner_name, partner_url
     FROM app_config WHERE id = 1`
  );
  return r.rows[0] || null;
}

/** Öffentlich: Mobile prüft Version & Wartung (ohne JWT). */
async function publicStatus(req, res, next) {
  try {
    const row = await readRow();
    if (!row) {
      return res.json({
        min_native_version: DEFAULT_ROW.min_native_version,
        maintenance: {
          enabled: DEFAULT_ROW.maintenance_enabled,
          message: DEFAULT_ROW.maintenance_message,
        },
        partner: {
          name: DEFAULT_ROW.partner_name,
          url: DEFAULT_ROW.partner_url,
        },
      });
    }
    res.json({
      min_native_version: row.min_native_version || DEFAULT_ROW.min_native_version,
      maintenance: {
        enabled: Boolean(row.maintenance_enabled),
        message: row.maintenance_message || "",
      },
      partner: {
        name: row.partner_name || "",
        url: row.partner_url || "",
      },
    });
  } catch (err) {
    next(err);
  }
}

async function getAppSettingsAdmin(req, res, next) {
  try {
    await ensureRow();
    const row = await readRow();
    const u = await query(`SELECT updated_at FROM app_config WHERE id = 1`);
    res.json({
      settings: {
        min_native_version: row?.min_native_version || DEFAULT_ROW.min_native_version,
        maintenance_enabled: Boolean(row?.maintenance_enabled),
        maintenance_message: row?.maintenance_message || "",
        partner_name: row?.partner_name || "",
        partner_url: row?.partner_url || "",
        updated_at: u.rows[0]?.updated_at || null,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function patchAppSettingsAdmin(req, res, next) {
  try {
    const minV =
      req.body.min_native_version !== undefined
        ? clip(req.body.min_native_version, 32)
        : null;
    const maintOn =
      req.body.maintenance_enabled !== undefined
        ? Boolean(req.body.maintenance_enabled)
        : null;
    const maintMsg =
      req.body.maintenance_message !== undefined
        ? clip(req.body.maintenance_message, 8000)
        : null;
    const partnerName =
      req.body.partner_name !== undefined
        ? clip(req.body.partner_name, 120)
        : null;
    const partnerUrl =
      req.body.partner_url !== undefined
        ? normalizeOptionalUrl(req.body.partner_url)
        : null;

    if (minV !== null) {
      if (minV.length === 0) {
        throw new HttpError(400, "min_native_version darf nicht leer sein.");
      }
      if (!/^\d+\.\d+\.\d+$/.test(minV)) {
        throw new HttpError(400, "min_native_version z. B. 1.0.0 (Semver).");
      }
    }

    await ensureRow();

    const sets = [];
    const vals = [];
    let i = 1;
    if (minV !== null) {
      sets.push(`min_native_version = $${i++}`);
      vals.push(minV);
    }
    if (maintOn !== null) {
      sets.push(`maintenance_enabled = $${i++}`);
      vals.push(maintOn);
    }
    if (maintMsg !== null) {
      sets.push(`maintenance_message = $${i++}`);
      vals.push(maintMsg);
    }
    if (partnerName !== null) {
      sets.push(`partner_name = $${i++}`);
      vals.push(partnerName);
    }
    if (partnerUrl !== null) {
      sets.push(`partner_url = $${i++}`);
      vals.push(partnerUrl);
    }
    if (sets.length === 0) {
      throw new HttpError(400, "Keine Felder.");
    }
    sets.push(`updated_at = NOW()`);
    await query(
      `UPDATE app_config SET ${sets.join(", ")} WHERE id = 1`,
      vals
    );

    const row = await readRow();
    const u = await query(`SELECT updated_at FROM app_config WHERE id = 1`);
    res.json({
      settings: {
        min_native_version: row.min_native_version,
        maintenance_enabled: Boolean(row.maintenance_enabled),
        maintenance_message: row.maintenance_message || "",
        partner_name: row.partner_name || "",
        partner_url: row.partner_url || "",
        updated_at: u.rows[0]?.updated_at || null,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  publicStatus,
  getAppSettingsAdmin,
  patchAppSettingsAdmin,
};
