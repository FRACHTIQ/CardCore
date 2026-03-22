/**
 * Claude API – vorbereitet für spätere KI-Features (Listing-Texte, Support, Moderation).
 * Ohne ANTHROPIC_API_KEY: in Produktion HTTP 503; lokal weiter Demo-Daten (mock).
 */
const Anthropic = require("@anthropic-ai/sdk");
const { HttpError } = require("../utils/httpError");

let client = null;

function getClient() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return null;
  }
  if (!client) {
    client = new Anthropic({ apiKey: key });
  }
  return client;
}

/**
 * @param {string} userPrompt
 * @param {string} [systemPrompt]
 * @returns {Promise<string>}
 */
async function completeText(userPrompt, systemPrompt) {
  const c = getClient();
  if (!c) {
    throw new Error("ANTHROPIC_API_KEY ist nicht gesetzt.");
  }
  const msg = await c.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 1024,
    system: systemPrompt || "Du hilfst bei CardCore, einer Sportkarten-Plattform. Antworte knapp auf Deutsch.",
    messages: [{ role: "user", content: userPrompt }],
  });
  const block = msg.content && msg.content[0];
  if (block && block.type === "text") {
    return block.text;
  }
  return "";
}

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
  if (m === "image/png" || m === "image/webp" || m === "image/jpeg") {
    return m;
  }
  return "image/jpeg";
}

function parseJsonObject(text) {
  const t = String(text || "").trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1].trim() : t;
  return JSON.parse(raw);
}

function mockAnalyzeCard() {
  return {
    sport: "Basketball",
    manufacturer: "Panini",
    set_name: "Prizm",
    year: 2023,
    player_name: "Demo Spieler",
    team: "",
    card_number: "",
    condition_grade: "NM-MT",
    description:
      "Demo-Erkennung ohne KI. Setze ANTHROPIC_API_KEY auf dem Server für echte Analyse.",
    card_type: "BASE",
    confidence: 0.12,
    mock: true,
  };
}

/**
 * @param {{ frontBase64: string, backBase64: string, frontMime?: string, backMime?: string }} p
 * @returns {Promise<object>}
 */
async function analyzeCardImages(p) {
  const front = stripDataUrlBase64(p.frontBase64);
  const back = stripDataUrlBase64(p.backBase64);
  if (!front || !back) {
    throw new Error("Vorder- und Rückseitenbild (Base64) erforderlich.");
  }
  if (front.length > 14 * 1024 * 1024 || back.length > 14 * 1024 * 1024) {
    throw new Error("Bilder zu groß (max. ca. 10 MB pro Seite).");
  }

  const c = getClient();
  if (!c) {
    if (process.env.NODE_ENV === "production") {
      throw new HttpError(
        503,
        "KI-Analyse ist nicht konfiguriert (ANTHROPIC_API_KEY fehlt)."
      );
    }
    return mockAnalyzeCard();
  }

  const fm = normalizeImageMime(p.frontMime);
  const bm = normalizeImageMime(p.backMime);

  const system = `Du bist Experte für Sammel- und Tradingkarten (Sport, TCG etc.).
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

  const msg = await c.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 1200,
    system,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Bild 1: VORDERSEITE der Karte. Bild 2: RÜCKSEITE der Karte. Erkenne alle lesbaren Details.",
          },
          {
            type: "image",
            source: { type: "base64", media_type: fm, data: front },
          },
          {
            type: "image",
            source: { type: "base64", media_type: bm, data: back },
          },
        ],
      },
    ],
  });

  const block = msg.content && msg.content[0];
  if (!block || block.type !== "text") {
    throw new Error("Unerwartete KI-Antwort.");
  }
  let parsed;
  try {
    parsed = parseJsonObject(block.text);
  } catch {
    throw new Error(
      "KI-Antwort war kein gültiges JSON. Bitte Fotos schärfer aufnehmen und erneut versuchen."
    );
  }
  return { ...parsed, mock: false };
}

module.exports = { getClient, completeText, analyzeCardImages, mockAnalyzeCard };
