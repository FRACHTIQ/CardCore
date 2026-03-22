const { query } = require("../db");

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const BATCH = 80;

function formatEur(cents) {
  const n = Number(cents) || 0;
  return (n / 100).toFixed(2);
}

async function notifyNewActiveListing(listing, { excludeUserId } = {}) {
  if (process.env.PUSH_NEW_LISTING_ENABLED === "0") {
    return;
  }
  if (!listing || listing.status !== "ACTIVE") {
    return;
  }

  let rows;
  try {
    const res = await query(
      `SELECT expo_push_token FROM user_push_token
       WHERE ($1::int IS NULL OR user_id <> $1::int)`,
      [excludeUserId || null]
    );
    rows = res.rows;
  } catch (e) {
    console.error("[push] user_push_token query failed:", e.message);
    return;
  }

  const tokens = rows.map((r) => r.expo_push_token).filter(Boolean);
  if (tokens.length === 0) {
    return;
  }

  const title = "VURAX · Neuer Upload";
  const body = `${listing.player_name || "Karte"} · € ${formatEur(
    listing.price_cents
  )}`;

  const payload = tokens.map((to) => ({
    to,
    sound: "default",
    title,
    body,
    data: {
      type: "new_listing",
      listing_id: listing.id,
    },
    channelId: "default",
  }));

  await sendExpoBatch(payload);
}

async function notifyNewMessage({ recipientUserId, title, body, data }) {
  if (process.env.PUSH_NEW_MESSAGE_ENABLED === "0") {
    return;
  }
  const uid = Number(recipientUserId);
  if (!Number.isInteger(uid) || uid < 1) {
    return;
  }
  let rows;
  try {
    const res = await query(
      `SELECT expo_push_token FROM user_push_token WHERE user_id = $1`,
      [uid]
    );
    rows = res.rows;
  } catch (e) {
    console.error("[push] notifyNewMessage query:", e.message);
    return;
  }
  const tokens = rows.map((r) => r.expo_push_token).filter(Boolean);
  if (tokens.length === 0) {
    return;
  }
  const payload = tokens.map((to) => ({
    to,
    sound: "default",
    title: title || "Neue Nachricht",
    body: body || "",
    data: data || {},
    channelId: "default",
  }));
  await sendExpoBatch(payload);
}

async function sendExpoBatch(payload) {
  for (let i = 0; i < payload.length; i += BATCH) {
    const chunk = payload.slice(i, i + BATCH);
    try {
      const r = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(chunk),
      });
      const text = await r.text();
      if (!r.ok) {
        console.error("[push] Expo HTTP", r.status, text.slice(0, 500));
        continue;
      }
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        continue;
      }
      const errs = Array.isArray(parsed.data)
        ? parsed.data.filter((x) => x.status === "error")
        : [];
      if (errs.length) {
        console.warn("[push] Expo partial errors:", errs.length);
      }
    } catch (e) {
      console.error("[push] Expo fetch failed:", e.message);
    }
  }
}

function fireAndNotifyNewListing(listing, opts) {
  setImmediate(() => {
    notifyNewActiveListing(listing, opts).catch((e) => {
      console.error("[push] notifyNewActiveListing:", e.message);
    });
  });
}

function fireAndNotifyNewMessage(payload) {
  setImmediate(() => {
    notifyNewMessage(payload).catch((e) => {
      console.error("[push] notifyNewMessage:", e.message);
    });
  });
}

module.exports = {
  notifyNewActiveListing,
  notifyNewMessage,
  fireAndNotifyNewListing,
  fireAndNotifyNewMessage,
};
