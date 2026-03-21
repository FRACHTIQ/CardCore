const { query } = require("../db");

/**
 * Öffentliche Kennzahlen für Website / Dashboard (ohne JWT).
 * Markt-Trend 24h: Vergleich Neuanlage-Wert letzte 24h vs. vorherige 24h.
 */
async function getMarketLive(req, res, next) {
  try {
    const [totals, trend, lastUpload, usersRow] = await Promise.all([
      query(
        `SELECT
           COALESCE(SUM(l.price_cents), 0)::bigint AS total_market_value_cents,
           COUNT(*)::int AS active_listings_count
         FROM listing l
         WHERE l.status = 'ACTIVE'`
      ),
      query(
        `SELECT
           COALESCE(SUM(CASE
             WHEN l.created_at >= NOW() - INTERVAL '24 hours'
             THEN l.price_cents ELSE 0 END), 0)::bigint AS value_last_24h_cents,
           COALESCE(SUM(CASE
             WHEN l.created_at >= NOW() - INTERVAL '48 hours'
              AND l.created_at < NOW() - INTERVAL '24 hours'
             THEN l.price_cents ELSE 0 END), 0)::bigint AS value_prev_24h_cents,
           COUNT(*) FILTER (WHERE l.created_at >= NOW() - INTERVAL '24 hours')::int AS new_listings_24h
         FROM listing l`
      ),
      query(
        `SELECT MAX(created_at) AS last_listing_at
         FROM listing`
      ),
      query(
        `SELECT COUNT(*)::int AS c FROM app_user WHERE suspended_at IS NULL`
      ),
    ]);

    const t = totals.rows[0] || {};
    const tr = trend.rows[0] || {};
    const last = lastUpload.rows[0]?.last_listing_at;
    const lastMs = last ? new Date(last).getTime() : null;
    const nowMs = Date.now();
    const secondsSinceLast =
      lastMs != null && !Number.isNaN(lastMs)
        ? Math.max(0, Math.floor((nowMs - lastMs) / 1000))
        : null;

    const vLast = Number(tr.value_last_24h_cents) || 0;
    const vPrev = Number(tr.value_prev_24h_cents) || 0;
    let trend24hPct = 0;
    if (vPrev > 0) {
      trend24hPct = ((vLast - vPrev) / vPrev) * 100;
    } else if (vLast > 0) {
      trend24hPct = 100;
    }

    res.json({
      generated_at: new Date().toISOString(),
      total_market_value_cents: Number(t.total_market_value_cents) || 0,
      total_market_value_eur:
        Math.round(Number(t.total_market_value_cents) || 0) / 100,
      active_listings_count: t.active_listings_count ?? 0,
      registered_users_count: usersRow.rows[0]?.c ?? 0,
      market_trend_24h_pct: Math.round(trend24hPct * 100) / 100,
      new_listings_24h: tr.new_listings_24h ?? 0,
      new_listings_value_last_24h_cents: vLast,
      last_listing_at: last ? new Date(last).toISOString() : null,
      seconds_since_last_listing: secondsSinceLast,
      live: {
        label: "Neuer Upload",
        new_listings_last_24h: tr.new_listings_24h ?? 0,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getMarketLive };
