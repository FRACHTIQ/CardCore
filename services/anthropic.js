/**
 * Claude API – vorbereitet für spätere KI-Features (Listing-Texte, Support, Moderation).
 * Ohne ANTHROPIC_API_KEY: in Produktion HTTP 503; lokal weiter Demo-Daten (mock).
 *
 * ANTHROPIC_MODEL: z. B. claude-3-5-sonnet-20241022 oder neuere IDs laut Anthropic-Doku.
 */
const Anthropic = require("@anthropic-ai/sdk");
const { APIError } = Anthropic;
const { HttpError } = require("../utils/httpError");

function visionModel() {
  const m = String(process.env.ANTHROPIC_MODEL || "").trim();
  /* Ohne Env: bewährtes Sonnet mit Vision; bei 404 auf Railway ANTHROPIC_MODEL setzen. */
  return m || "claude-3-5-sonnet-20241022";
}

/**
 * Kurzer Text aus Anthropic-Fehler (ohne riesiges JSON in der App).
 * @param {import("@anthropic-ai/sdk").APIError} err
 * @returns {string}
 */
function anthropicApiMessage(err) {
  const body = err && err.error;
  if (body && typeof body === "object") {
    const nested = body.error;
    if (nested && typeof nested === "object" && typeof nested.message === "string") {
      return nested.message.trim();
    }
    if (typeof body.message === "string") {
      return body.message.trim();
    }
  }
  const m = String(err.message || "").replace(/^\d{3}\s+/, "").trim();
  const brace = m.indexOf("{");
  if (brace >= 0) {
    try {
      const o = JSON.parse(m.slice(brace));
      if (o.error && typeof o.error.message === "string") {
        return o.error.message.trim();
      }
      if (typeof o.message === "string") {
        return o.message.trim();
      }
    } catch {
      /* ignore */
    }
  }
  return m.slice(0, 280);
}

/**
 * @param {unknown} err
 * @returns {never}
 */
function rethrowAnthropicAnalyze(err) {
  if (err instanceof HttpError) {
    throw err;
  }
  if (err instanceof APIError) {
    const st = err.status;
    if (st === 401 || st === 403) {
      throw new HttpError(
        503,
        "KI-API-Schlüssel ungültig oder ohne Berechtigung (Server: ANTHROPIC_API_KEY prüfen)."
      );
    }
    if (st === 404) {
      throw new HttpError(
        502,
        "KI-Modell nicht gefunden. Bitte ANTHROPIC_MODEL setzen (siehe .env.example) oder Anthropic-Konto prüfen."
      );
    }
    if (st === 429) {
      throw new HttpError(
        429,
        "Zu viele KI-Anfragen. Bitte kurz warten und erneut versuchen."
      );
    }
    if (st === 400) {
      const apiMsg = anthropicApiMessage(err);
      const low = apiMsg.toLowerCase();
      /* Nur echte Guthaben-Meldungen (nicht jedes "billing" in anderen 400ern). */
      const looksLikeNoCredits =
        low.includes("credit balance") ||
        low.includes("too low to access") ||
        low.includes("plans & billing") ||
        low.includes("purchase credits") ||
        low.includes("insufficient credits") ||
        low.includes("no credits");
      if (looksLikeNoCredits) {
        throw new HttpError(
          503,
          "Anthropic meldet für den API-Key auf dem Server kein nutzbares Guthaben. Aufgeladen? Dann in Railway unter Variables ANTHROPIC_API_KEY mit einem Key aus genau diesem Konto setzen und neu deployen. Sonst Felder manuell ausfüllen."
        );
      }
      throw new HttpError(
        400,
        apiMsg || "Ungültige Anfrage an die KI (z. B. Bildformat)."
      );
    }
    console.error("[anthropic] messages.create", err);
    throw new HttpError(
      502,
      "KI-Dienst vorübergehend nicht erreichbar. Bitte später erneut versuchen."
    );
  }
  console.error("[anthropic] analyzeCardImages", err);
  const msg = err && err.message ? String(err.message).slice(0, 240) : "";
  throw new HttpError(
    502,
    msg
      ? `KI-Analyse fehlgeschlagen: ${msg}`
      : "KI-Analyse fehlgeschlagen. Bitte später erneut versuchen."
  );
}

let client = null;
let clientKeyFingerprint = null;

function normalizeEnvApiKey(raw) {
  let k = String(raw || "").trim();
  /* Railway/Copy-Paste: Wert oft als "sk-ant-..." eingetragen — Quotes würden 401 verursachen. */
  if (
    (k.startsWith('"') && k.endsWith('"')) ||
    (k.startsWith("'") && k.endsWith("'"))
  ) {
    k = k.slice(1, -1).trim();
  }
  return k;
}

function getClient() {
  const key = normalizeEnvApiKey(process.env.ANTHROPIC_API_KEY);
  if (!key) {
    client = null;
    clientKeyFingerprint = null;
    return null;
  }
  /* Nach Key-Änderung in Railway/.env neuen Client bauen (ohne Full-Key zu loggen). */
  if (!client || clientKeyFingerprint !== key) {
    client = new Anthropic({ apiKey: key });
    clientKeyFingerprint = key;
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
    model: visionModel(),
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
  if (
    m === "image/png" ||
    m === "image/webp" ||
    m === "image/jpeg" ||
    m === "image/gif"
  ) {
    return m;
  }
  /* iOS liefert oft HEIC; API erwartet i. d. R. jpeg/png/webp – Client sollte JPEG wählen. */
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
    throw new HttpError(400, "Vorder- und Rückseitenbild (Base64) erforderlich.");
  }
  if (front.length > 14 * 1024 * 1024 || back.length > 14 * 1024 * 1024) {
    throw new HttpError(400, "Bilder zu groß (max. ca. 10 MB pro Seite).");
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

  let msg;
  try {
    msg = await c.messages.create({
      model: visionModel(),
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
  } catch (e) {
    rethrowAnthropicAnalyze(e);
  }

  const blocks = Array.isArray(msg.content) ? msg.content : [];
  const textBlock = blocks.find((b) => b && b.type === "text" && b.text);
  if (!textBlock) {
    throw new HttpError(
      502,
      "Unerwartete KI-Antwort (kein Text). Bitte erneut versuchen."
    );
  }
  let parsed;
  try {
    parsed = parseJsonObject(textBlock.text);
  } catch {
    throw new HttpError(
      422,
      "KI-Antwort war kein gültiges JSON. Bitte Fotos schärfer aufnehmen und erneut versuchen."
    );
  }
  assertCardAiObject(parsed);
  return { ...parsed, mock: false };
}

module.exports = { getClient, completeText, analyzeCardImages, mockAnalyzeCard };
