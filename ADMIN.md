# Admin-Backend & Web-UI

## Datenbank

Nach `001_initial.sql` (enthält bereits Admin-Spalten) oder bei bestehender DB: **`sql/005_admin.sql`** in PostgreSQL ausführen.

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
| PATCH | `/users/:id` | `is_verified`, `verification_note`, `role`, `suspended` |
| GET | `/listings` | Liste mit Verkäufer (`search`, `status`, Pagination) |
| GET | `/listings/:id` | Detail |
| PATCH | `/listings/:id` | `status` (z. B. Moderation → `ARCHIVED`) |
| GET | `/support/tickets` | Support-Übersicht |
| GET | `/support/tickets/:id` | Ticket + Nachrichten |
| POST | `/support/tickets/:id/messages` | Staff-Antwort (`body`) |
| PATCH | `/support/tickets/:id` | `status` |

Header: `Authorization: Bearer <token>`.

## Fehler „Serverfehler“ / 500 unter `/api/admin/users`

Meist fehlen noch Spalten in `app_user` (Admin/Avatar). In Railway **PostgreSQL** → **Query** nacheinander ausführen:

1. Inhalt von `sql/004_avatar.sql` (falls noch nicht gelaufen)
2. Inhalt von `sql/005_admin.sql`

Danach Deploy neu laden; die Nutzerliste sollte laden.

## Web-Dashboard

Server starten, im Browser: **`http://localhost:3000/admin/`** (oder eure Railway-URL + `/admin/`).

Anmeldung mit einem **Admin-Konto** (normales Login über `/api/auth/login`); Nutzer ohne `role = admin` werden im UI abgewiesen.

## Login & Sperre

- Login liefert `user.role` (`user` | `admin`).
- Gesperrte Konten (`suspended_at` gesetzt) erhalten **403** beim Login.
