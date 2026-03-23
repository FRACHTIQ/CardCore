# Admin-Backend & Web-UI

## Datenbank

Nach `001_initial.sql` (enthält bereits Admin-Spalten) oder bei bestehender DB: **`sql/005_admin.sql`**, **`sql/006_app_config.sql`** in PostgreSQL ausführen (Reihenfolge siehe `sql/README.md`). Für **Private Trade** zusätzlich **`sql/015_private_market.sql`**.

## Admin-Nutzer anlegen (empfohlen)

Im Projektordner, mit gültiger `DATABASE_URL` in `.env` (bei Verbindung zu Railway von deinem PC oft **`NODE_ENV=production`** setzen, damit SSL passt):

```powershell
cd $env:USERPROFILE\Desktop\CardCore
$env:NODE_ENV="production"
node scripts/create-admin.js "admin@deinedomain.de" "DeinSicheresPasswort8+" "Admin Name"
```

Oder per npm:

```powershell
$env:NODE_ENV="production"
npm run create-admin -- "admin@deinedomain.de" "DeinSicheresPasswort8+"
```

- **Neues Konto:** Nutzer wird mit `role = admin` angelegt.
- **E-Mail existiert schon:** Konto wird zum Admin hochgestuft und das **Passwort** wird auf den angegebenen Wert gesetzt.

## Nur Rolle setzen (SQL)

```sql
UPDATE app_user SET role = 'admin' WHERE email = 'deine@email.de';
```

## API (alle unter `/api/admin`, nur mit JWT **und** `role = 'admin'`)

| Methode | Pfad | Beschreibung |
|--------|------|----------------|
| GET | `/dashboard` | KPIs (Nutzer, Listings, Umsatz, Support) |
| GET | `/revenue` | Aggregation nach Listing-Status |
| GET | `/users` | Liste (`search`, `limit`, `offset`) |
| GET | `/users/:id` | Nutzer-Detail inkl. Stats |
| PATCH | `/users/:id` | `is_verified`, `verification_note`, `role`, `suspended`, **`private_market_access`** (Private Trade) |
| GET | `/listings` | Liste mit Verkäufer (`search`, `status`, Pagination) |
| GET | `/listings/:id` | Detail |
| PATCH | `/listings/:id` | `status` (z. B. Moderation → `ARCHIVED`) |
| GET | `/support/tickets` | Support-Übersicht |
| GET | `/support/tickets/:id` | Ticket + Nachrichten |
| POST | `/support/tickets/:id/messages` | Staff-Antwort (`body`) |
| PATCH | `/support/tickets/:id` | `status` |
| GET | `/app-settings` | Mindest-Version, Wartung (lesen) |
| PATCH | `/app-settings` | `min_native_version`, `maintenance_enabled`, `maintenance_message` |
| POST | `/welcome-dm` | Willkommens-DM nachträglich senden, Body: `{ "user_id": 4 }` (nur Server-DB, z. B. Railway) |

Öffentlich (ohne Login): **`GET /api/app/status`** – liefert `min_native_version` und `maintenance` für die Mobile-App (Startprüfung).

Header: `Authorization: Bearer <token>`.

## App-Version & Wartung (Web-Tab „App & Wartung“)

- **`min_native_version`:** Semver (z. B. `1.0.0`). Liegt die installierte App-Version **darunter**, zeigt die App einen **Update-Zwang** (kein normaler Login bis zum Update).
- **Wartungsmodus:** Text aus dem Dashboard erscheint in der App als **Vollbild**; Nutzer können die App nicht nutzen, bis der Modus deaktiviert wird.

**Push-Benachrichtigung** bei neuer Version ist nicht automatisch dabei – Nutzer sehen den Hinweis beim **nächsten App-Start** (oder nach erneutem Öffnen).

## Fehler „Serverfehler“ / 500 unter `/api/admin/users`

Meist fehlen noch Spalten in `app_user` (Admin/Avatar). In Railway **PostgreSQL** → **Query** nacheinander ausführen:

1. Inhalt von `sql/004_avatar.sql` (falls noch nicht gelaufen)
2. Inhalt von `sql/005_admin.sql`

Danach Deploy neu laden; die Nutzerliste sollte laden.

## Web-Dashboard

Server starten, im Browser: **`http://localhost:3000/admin/`** (oder eure Railway-URL + `/admin/`).

Anmeldung mit einem **Admin-Konto** (normales Login über `/api/auth/login`); Nutzer ohne `role = admin` werden im UI abgewiesen.

**Tab „Willkommen“:** Nutzer auswählen (oder User-ID eintragen) und „Testnachricht senden“ – ruft dieselbe Logik wie `POST /api/admin/welcome-dm` auf (Willkommens-DM in der App unter Nachrichten).

## Login & Sperre

- Login liefert `user.role` (`user` | `admin`).
- Gesperrte Konten (`suspended_at` gesetzt) erhalten **403** beim Login.
