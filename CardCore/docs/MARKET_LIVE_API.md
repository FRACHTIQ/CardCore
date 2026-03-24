# Öffentliche Markt-Live-API (Website)

## `GET /api/public/market-live`

Kein JWT. CORS ist für Browser-Anfragen freigegeben (`origin: true`).

### Beispielantwort

```json
{
  "generated_at": "2026-03-21T12:00:00.000Z",
  "total_market_value_cents": 1234500,
  "total_market_value_eur": 12345,
  "active_listings_count": 42,
  "registered_users_count": 120,
  "market_trend_24h_pct": 3.5,
  "new_listings_24h": 8,
  "new_listings_value_last_24h_cents": 89000,
  "last_listing_at": "2026-03-21T11:58:00.000Z",
  "seconds_since_last_listing": 120,
  "live": {
    "label": "Neuer Upload",
    "new_listings_last_24h": 8
  }
}
```

- **market_trend_24h_pct**: Vergleich der **Summe der Preise** aller in den letzten 24h **neu angelegten** Listings vs. der vorangegangenen 24h (Aktivitäts-/Volumen-Trend).
- **seconds_since_last_listing**: für relative Anzeige („gerade eben“).

### Website (Fetch)

```js
const r = await fetch("https://cardcore-production.up.railway.app/api/public/market-live");
const data = await r.json();
```

## Push bei neuem Listing

1. SQL `sql/007_market_push.sql` in PostgreSQL ausführen.
2. App registriert `POST /api/users/me/push-token` mit `expo_push_token`.
3. Bei **ACTIVE** Listing (Create oder DRAFT→ACTIVE) sendet der Server einen Expo-Broadcast (ohne den Verkäufer).

**Deaktivieren:** `PUSH_NEW_LISTING_ENABLED=0` in Railway.

**EAS:** Für `getExpoPushTokenAsync` in der App `extra.eas.projectId` in `app.json` setzen (nach `eas init`).
