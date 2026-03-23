const { HttpError } = require("../utils/httpError");
const { normalizeEnvSecret } = require("../utils/envSecret");
const { analyzeCardImages } = require("../services/cardAnalyze");

const CARD_TYPES = new Set([
  "BASE",
  "NUMBERED",
  "AUTOGRAPH",
  "PATCH",
  "ROOKIE",
]);

function status(req, res) {
  res.json({
    anthropic_configured: Boolean(normalizeEnvSecret(process.env.ANTHROPIC_API_KEY)),
    gemini_configured: Boolean(normalizeEnvSecret(process.env.GEMINI_API_KEY)),
    card_ai_provider: String(process.env.CARD_AI_PROVIDER || "auto").trim() || "auto",
  });
}

function normalizeCardType(raw) {
  const t = String(raw || "")
    .toUpperCase()
    .trim();
  return CARD_TYPES.has(t) ? t : "BASE";
}

function normalizeYear(y) {
  const n = Number(y);
  if (!Number.isInteger(n) || n < 1800 || n > 2100) {
    return new Date().getFullYear();
  }
  return n;
}

function normalizeMarketValueEur(raw) {
  const v =
    raw.market_value_eur !== undefined && raw.market_value_eur !== null
      ? raw.market_value_eur
      : raw.estimated_market_value_eur;
  if (v === undefined || v === null || v === "") {
    return null;
  }
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000) {
    return null;
  }
  return Math.round(n * 100) / 100;
}

async function analyzeCard(req, res, next) {
  try {
    const { front_base64, back_base64, front_mime, back_mime } = req.body || {};
    if (!front_base64 || !back_base64) {
      throw new HttpError(400, "front_base64 und back_base64 sind erforderlich.");
    }
    const raw = await analyzeCardImages({
      frontBase64: front_base64,
      backBase64: back_base64,
      frontMime: front_mime,
      backMime: back_mime,
    });

    const out = {
      sport: String(raw.sport || "").trim(),
      manufacturer: String(raw.manufacturer || "").trim(),
      set_name: String(raw.set_name || "").trim(),
      year: normalizeYear(raw.year),
      player_name: String(raw.player_name || "").trim(),
      team: String(raw.team || "").trim(),
      card_number: String(raw.card_number || "").trim(),
      condition_grade: String(raw.condition_grade || "").trim(),
      description: String(raw.description || "").trim(),
      card_type: normalizeCardType(raw.card_type),
      confidence:
        typeof raw.confidence === "number" && raw.confidence >= 0 && raw.confidence <= 1
          ? raw.confidence
          : null,
      market_value_eur: normalizeMarketValueEur(raw),
      market_value_source: String(raw.market_value_source || "").trim().slice(0, 240),
      mock: Boolean(raw.mock),
    };

    res.json(out);
  } catch (err) {
    next(err);
  }
}

module.exports = { status, analyzeCard };
