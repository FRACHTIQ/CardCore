const { HttpError } = require("../utils/httpError");

const CARD_TYPES_AI = [
  "BASE",
  "NUMBERED",
  "AUTOGRAPH",
  "PATCH",
  "ROOKIE",
];

function stripDataUrlBase64(raw) {
  if (typeof raw !== "string") {
    return "";
  }
  const s = raw.trim();
  const m = s.match(/^data:image\/[^;]+;base64,(.+)$/i);
  return m ? m[1] : s;
}

function normalizeImageMime(mime) {
  const m = String(mime || "")
    .toLowerCase()
    .trim();
  if (m === "image/jpg") {
    return "image/jpeg";
  }
  if (
    m === "image/png" ||
    m === "image/webp" ||
    m === "image/jpeg" ||
    m === "image/gif"
  ) {
    return m;
  }
  if (m === "image/heic" || m === "image/heif") {
    return "image/jpeg";
  }
  return "image/jpeg";
}

function parseJsonObject(text) {
  const t = String(text || "").trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1].trim() : t;
  return JSON.parse(raw);
}

function assertCardAiObject(parsed) {
  if (
    parsed == null ||
    typeof parsed !== "object" ||
    Array.isArray(parsed)
  ) {
    throw new HttpError(
      422,
      "KI-Antwort war kein Objekt (z. B. nur Text). Bitte erneut versuchen."
    );
  }
}

function cardVisionSystemPrompt() {
  return `Du bist Experte für Sammel- und Tradingkarten (Sport, TCG etc.).
Antworte ausschließlich mit einem JSON-Objekt (kein Markdown, kein Fließtext).
Pflichtfelder:
- sport (string)
- manufacturer (string, z. B. Panini, Topps)
- set_name (string)
- year (Zahl, Erscheinungsjahr der Karte oder des Sets)
- player_name (string, leer wenn nicht lesbar)
- team (string, leer wenn nicht lesbar)
- card_number (string, Katalognummer falls sichtbar)
- condition_grade (string, z. B. NM, NM-MT, EX – Schätzung aus Fotos)
- description (string, 1–3 Sätze auf Deutsch)
- card_type (einer von: ${CARD_TYPES_AI.join(", ")})
- confidence (Zahl 0 bis 1, wie sicher du bist)

Nutze beide Bilder: erst Vorderseite (Spieler, Design), dann Rückseite (Infos, Nummern).`;
}

module.exports = {
  CARD_TYPES_AI,
  stripDataUrlBase64,
  normalizeImageMime,
  parseJsonObject,
  assertCardAiObject,
  cardVisionSystemPrompt,
};
