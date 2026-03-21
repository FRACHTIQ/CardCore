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
};

async function ensureRow() {
  await query(
    `INSERT INTO app_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING`
  );
}

async function readRow() {
  const r = await query(
    `SELECT min_native_version, maintenance_enabled, maintenance_message
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
      });
    }
    res.json({
      min_native_version: row.min_native_version || DEFAULT_ROW.min_native_version,
      maintenance: {
        enabled: Boolean(row.maintenance_enabled),
        message: row.maintenance_message || "",
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
