# Datenbank-Migrationen

Reihenfolge in PostgreSQL (z. B. Railway):

1. `001_initial.sql` – Schema (falls noch nicht ausgeführt)
2. `002_profile_trade.sql` – Handels-/Versandfelder auf `app_user`
3. `003_support.sql` – `terms_accepted_at` auf `app_user`, Support-Tickets (`support_ticket`, `support_message`)
4. `004_avatar.sql` – `avatar_url` auf `app_user` (Profilbild als Data-URL)
5. `005_admin.sql` – `role` (`user`/`admin`), `is_verified`, `verification_note`, `suspended_at` auf `app_user`
6. `006_app_config.sql` – `app_config` (Mindest-App-Version, Wartungsmodus & -text für die native App)

7. `007_market_push.sql` – Push-Registrierung (Expo) – falls im Projekt vorhanden
8. `008_marketplace_extensions.sql` – Angebote, Deals, … – falls vorhanden
9. `009_welcome_system_dm.sql` / `010_…` – Willkommens-DM – falls vorhanden
10. **`011_message_image.sql`** – `message.image_url` für Bilder in Chats (Data-URL)

**Hinweis:** `002` ist nur nötig, wenn die Datenbank bereits mit `001` ohne die neuen Spalten angelegt wurde. Bei einem **frischen** Setup aus `001_initial.sql` (inkl. `legal_name`, …) kann `002` übersprungen werden.
