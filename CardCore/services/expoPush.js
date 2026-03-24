const { query } = require("../db");



const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const BATCH = 80;



function formatEur(cents) {

  const n = Number(cents) || 0;

  return (n / 100).toFixed(2);

}



function isNewListingPushEnabled() {

  return process.env.PUSH_NEW_LISTING_ENABLED !== "0";

}



function isOfferDealPushEnabled() {

  return process.env.PUSH_OFFERS_DEALS_ENABLED !== "0";

}



async function sendExpoNotifications(messages) {

  if (!messages || messages.length === 0) {

    return;

  }

  for (let i = 0; i < messages.length; i += BATCH) {

    const chunk = messages.slice(i, i + BATCH);

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

      let data;

      try {

        data = JSON.parse(text);

      } catch {

        continue;

      }

      const errs = Array.isArray(data.data)

        ? data.data.filter((x) => x.status === "error")

        : [];

      if (errs.length) {

        console.warn("[push] Expo partial errors:", errs.length);

      }

    } catch (e) {

      console.error("[push] Expo fetch failed:", e.message);

    }

  }

}



/**

 * Push an registrierte Geräte der angegebenen Nutzer-IDs (z. B. Angebote, Deals).

 */

async function notifyUserIds(userIds, { title, body, data = {} }) {

  if (!isOfferDealPushEnabled()) {

    return;

  }

  const ids = [

    ...new Set(

      (userIds || [])

        .map((x) => Number(x))

        .filter((n) => Number.isInteger(n) && n > 0)

    ),

  ];

  if (ids.length === 0) {

    return;

  }

  let rows;

  try {

    const res = await query(

      `SELECT expo_push_token FROM user_push_token WHERE user_id = ANY($1::int[])`,

      [ids]

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

  const messages = tokens.map((to) => ({

    to,

    sound: "default",

    title,

    body,

    data: { ...data },

    channelId: "default",

  }));

  await sendExpoNotifications(messages);

}



function fireNotifyUserIds(userIds, payload) {

  setImmediate(() => {

    notifyUserIds(userIds, payload).catch((e) => {

      console.error("[push] notifyUserIds:", e.message);

    });

  });

}



async function notifyNewActiveListing(listing, { excludeUserId } = {}) {

  if (!isNewListingPushEnabled()) {

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



  const title = "VUREX · Neuer Upload";

  const body = `${listing.player_name || "Karte"} · € ${formatEur(

    listing.price_cents

  )}`;



  const messages = tokens.map((to) => ({

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



  await sendExpoNotifications(messages);

}



function fireAndNotifyNewListing(listing, opts) {

  setImmediate(() => {

    notifyNewActiveListing(listing, opts).catch((e) => {

      console.error("[push] notifyNewActiveListing:", e.message);

    });

  });

}



function isNewMessagePushEnabled() {

  return process.env.PUSH_NEW_MESSAGE_ENABLED !== "0";

}



async function notifyNewMessage(recipientUserId, { title, body, data = {} }) {

  if (!isNewMessagePushEnabled()) {

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

  const messages = tokens.map((to) => ({

    to,

    sound: "default",

    title: title || "Neue Nachricht",

    body: body || "",

    data: { ...data },

    channelId: "default",

  }));

  await sendExpoNotifications(messages);

}



function fireNotifyNewMessage(recipientUserId, payload) {

  setImmediate(() => {

    notifyNewMessage(recipientUserId, payload).catch((e) => {

      console.error("[push] notifyNewMessage:", e.message);

    });

  });

}



module.exports = {

  formatEur,

  notifyNewActiveListing,

  fireAndNotifyNewListing,

  notifyUserIds,

  fireNotifyUserIds,

  sendExpoNotifications,

  notifyNewMessage,

  fireNotifyNewMessage,

};


