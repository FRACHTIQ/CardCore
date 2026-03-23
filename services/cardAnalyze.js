const { HttpError } = require("../utils/httpError");
const { normalizeEnvSecret } = require("../utils/envSecret");
const { analyzeCardImages: analyzeCardImagesAnthropic } = require("./anthropic");
const { analyzeCardImagesGemini } = require("./geminiCardVision");

function hasAnthropicKey() {
  return Boolean(normalizeEnvSecret(process.env.ANTHROPIC_API_KEY));
}

function hasGeminiKey() {
  return Boolean(normalizeEnvSecret(process.env.GEMINI_API_KEY));
}

/**
 * @param {HttpError} err
 * @returns {boolean}
 */
function shouldTryGeminiAfterAnthropicFailure(err) {
  if (!(err instanceof HttpError)) {
    return true;
  }
  const code = err.statusCode;
  return (
    code === 400 ||
    code === 401 ||
    code === 404 ||
    code === 422 ||
    code === 429 ||
    code === 502 ||
    code === 503
  );
}

/**
 * Kartenbilder: Anthropic und/oder Gemini per CARD_AI_PROVIDER / Fallback.
 * @param {{ frontBase64: string, backBase64: string, frontMime?: string, backMime?: string }} p
 * @returns {Promise<object>}
 */
async function analyzeCardImages(p) {
  const mode = String(process.env.CARD_AI_PROVIDER || "auto")
    .toLowerCase()
    .trim();

  if (mode === "gemini") {
    return analyzeCardImagesGemini(p);
  }
  if (mode === "anthropic") {
    return analyzeCardImagesAnthropic(p);
  }

  /* auto */
  const ha = hasAnthropicKey();
  const hg = hasGeminiKey();

  if (ha) {
    try {
      return await analyzeCardImagesAnthropic(p);
    } catch (e) {
      if (hg && shouldTryGeminiAfterAnthropicFailure(e)) {
        console.warn("[cardAnalyze] Anthropic fehlgeschlagen, nutze Gemini:", e.message);
        return analyzeCardImagesGemini(p);
      }
      throw e;
    }
  }
  if (hg) {
    return analyzeCardImagesGemini(p);
  }
  return analyzeCardImagesAnthropic(p);
}

module.exports = { analyzeCardImages, hasAnthropicKey, hasGeminiKey };
