/**
 * Claude API – vorbereitet für spätere KI-Features (Listing-Texte, Support, Moderation).
 * Ohne ANTHROPIC_API_KEY: Aufrufe schlagen mit klarem Fehler fehl.
 */
const Anthropic = require("@anthropic-ai/sdk");

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

module.exports = { getClient, completeText };
