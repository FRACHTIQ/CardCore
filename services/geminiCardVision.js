const { GoogleGenerativeAI } = require("@google/generative-ai");
const { HttpError } = require("../utils/httpError");
const { normalizeEnvSecret } = require("../utils/envSecret");
const {
  stripDataUrlBase64,
  normalizeImageMime,
  parseJsonObject,
  assertCardAiObject,
  cardVisionSystemPrompt,
} = require("./cardVisionShared");

function geminiModelId() {
  const m = String(process.env.GEMINI_MODEL || "").trim();
  return m || "gemini-2.0-flash";
}

/**
 * @param {unknown} err
 * @returns {never}
 */
function rethrowGeminiCard(err) {
  if (err instanceof HttpError) {
    throw err;
  }
  const msg = String(err && err.message ? err.message : err);
  const low = msg.toLowerCase();
  if (
    low.includes("api key not valid") ||
    low.includes("invalid api key") ||
    low.includes("permission denied") ||
    low.includes("request had invalid authentication")
  ) {
    throw new HttpError(
      503,
      "Gemini-API-Key ungültig oder ohne Berechtigung (GEMINI_API_KEY prüfen)."
    );
  }
  if (low.includes("resource has been exhausted") || low.includes("quota")) {
    throw new HttpError(
      429,
      "Gemini-Quota erreicht. Bitte später erneut versuchen oder Kontingent prüfen."
    );
  }
  if (low.includes("not found") || low.includes("is not found")) {
    throw new HttpError(
      502,
      "Gemini-Modell nicht gefunden. Bitte GEMINI_MODEL setzen (z. B. gemini-1.5-flash)."
    );
  }
  console.error("[gemini] analyzeCardImages", err);
  throw new HttpError(
    502,
    msg.length > 220 ? `${msg.slice(0, 220)}…` : msg || "Gemini-Analyse fehlgeschlagen."
  );
}

/**
 * @param {{ frontBase64: string, backBase64: string, frontMime?: string, backMime?: string }} p
 * @returns {Promise<object>}
 */
async function analyzeCardImagesGemini(p) {
  const apiKey = normalizeEnvSecret(process.env.GEMINI_API_KEY);
  if (!apiKey) {
    throw new HttpError(503, "GEMINI_API_KEY ist nicht gesetzt.");
  }

  const front = stripDataUrlBase64(p.frontBase64);
  const back = stripDataUrlBase64(p.backBase64);
  if (!front || !back) {
    throw new HttpError(400, "Vorder- und Rückseitenbild (Base64) erforderlich.");
  }
  if (front.length > 14 * 1024 * 1024 || back.length > 14 * 1024 * 1024) {
    throw new HttpError(400, "Bilder zu groß (max. ca. 10 MB pro Seite).");
  }

  const fm = normalizeImageMime(p.frontMime);
  const bm = normalizeImageMime(p.backMime);
  const system = cardVisionSystemPrompt();

  const genAI = new GoogleGenerativeAI(apiKey);
  let textOut = "";
  try {
    const model = genAI.getGenerativeModel({
      model: geminiModelId(),
      systemInstruction: system,
    });
    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: "Bild 1: VORDERSEITE der Karte. Bild 2: RÜCKSEITE der Karte. Erkenne alle lesbaren Details.",
            },
            { inlineData: { mimeType: fm, data: front } },
            { inlineData: { mimeType: bm, data: back } },
          ],
        },
      ],
      generationConfig: { maxOutputTokens: 1200 },
    });
    textOut = result.response.text();
  } catch (e) {
    rethrowGeminiCard(e);
  }

  if (!String(textOut || "").trim()) {
    throw new HttpError(502, "Gemini lieferte keinen Text. Bitte erneut versuchen.");
  }

  let parsed;
  try {
    parsed = parseJsonObject(textOut);
  } catch {
    throw new HttpError(
      422,
      "KI-Antwort war kein gültiges JSON. Bitte Fotos schärfer aufnehmen und erneut versuchen."
    );
  }
  assertCardAiObject(parsed);
  return { ...parsed, mock: false };
}

module.exports = { analyzeCardImagesGemini, geminiModelId };
