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
  partner_links_json: "[]",
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

function parsePartnerLinksJson(raw) {
  if (!raw) {
    return [];
  }
  try {
    const arr = JSON.parse(String(raw));
    if (!Array.isArray(arr)) {
      return [];
    }
    return arr
      .map((p) => {
        const name = clip(p?.name, 120);
        const url = normalizeOptionalUrl(p?.url);
        if (!name || !url) {
          return null;
        }
        return { name, url };
      })
      .filter(Boolean)
      .slice(0, 20);
  } catch {
    return [];
  }
}

function normalizePartnerLinksInput(v) {
  if (!Array.isArray(v)) {
    throw new HttpError(400, "partner_links muss ein Array sein.");
  }
  return v
    .map((p) => {
      const name = clip(p?.name, 120);
      const url = normalizeOptionalUrl(p?.url);
      if (!name || !url) {
        return null;
      }
      return { name, url };
    })
    .filter(Boolean)
    .slice(0, 20);
}

async function ensureRow() {
  await query(
    `INSERT INTO app_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING`
  );
}

async function readRow() {
  try {
    const r = await query(
      `SELECT min_native_version, maintenance_enabled, maintenance_message, partner_name, partner_url, partner_links_json
       FROM app_config WHERE id = 1`
    );
    return r.rows[0] || null;
  } catch (err) {
    // Fallback für Umgebungen, in denen Migration 019 noch nicht gelaufen ist.
    const r = await query(
      `SELECT min_native_version, maintenance_enabled, maintenance_message, partner_name, partner_url, '[]'::text AS partner_links_json
       FROM app_config WHERE id = 1`
    );
    return r.rows[0] || null;
  }
}

/** Öffentlich: Mobile prüft Version & Wartung (ohne JWT). */
async function publicStatus(req, res, next) {
  try {
    const row = await readRow();
    if (!row) {
      const partnerLinks = [];
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
        partner_links: partnerLinks,
      });
    }
    const partnerLinks = parsePartnerLinksJson(row.partner_links_json);
    const fallbackPartnerName = row.partner_name || "";
    const fallbackPartnerUrl = row.partner_url || "";
    const partnerName = partnerLinks[0]?.name || fallbackPartnerName;
    const partnerUrl = partnerLinks[0]?.url || fallbackPartnerUrl;
    res.json({
      min_native_version: row.min_native_version || DEFAULT_ROW.min_native_version,
      maintenance: {
        enabled: Boolean(row.maintenance_enabled),
        message: row.maintenance_message || "",
      },
      partner: {
        name: partnerName,
        url: partnerUrl,
      },
      partner_links: partnerLinks,
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
    const partnerLinks = parsePartnerLinksJson(row?.partner_links_json);
    res.json({
      settings: {
        min_native_version: row?.min_native_version || DEFAULT_ROW.min_native_version,
        maintenance_enabled: Boolean(row?.maintenance_enabled),
        maintenance_message: row?.maintenance_message || "",
        partner_name: row?.partner_name || "",
        partner_url: row?.partner_url || "",
        partner_links: partnerLinks,
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
    const partnerLinks =
      req.body.partner_links !== undefined
        ? normalizePartnerLinksInput(req.body.partner_links)
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
    if (partnerLinks !== null) {
      sets.push(`partner_links_json = $${i++}`);
      vals.push(JSON.stringify(partnerLinks));
      const first = partnerLinks[0] || null;
      sets.push(`partner_name = $${i++}`);
      vals.push(first ? first.name : "");
      sets.push(`partner_url = $${i++}`);
      vals.push(first ? first.url : "");
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
    const normalizedPartnerLinks = parsePartnerLinksJson(row.partner_links_json);
    res.json({
      settings: {
        min_native_version: row.min_native_version,
        maintenance_enabled: Boolean(row.maintenance_enabled),
        maintenance_message: row.maintenance_message || "",
        partner_name: row.partner_name || "",
        partner_url: row.partner_url || "",
        partner_links: normalizedPartnerLinks,
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
