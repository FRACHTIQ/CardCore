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
11. **`012_profile_presence_social.sql`** – `last_seen_at`, `social_links`, `show_last_seen` auf `app_user`
12. **`013_user_block_report.sql`** – `user_block`, `user_report` (Blockieren & Melden)
13. **`014_response_metrics.sql`** – Antwortzeit-Metriken (falls vorhanden)
14. **`015_private_market.sql`** – **Private Trade:** `app_user.private_market_access`, `listing.is_private_market`
15. **`016_private_market_invites.sql`** – Einladungscodes (`private_market_invite`, `private_market_invite_redemption`)
16. **`017_email_verification.sql`** – `app_user.email_verified_at`, Tabelle `email_verification_otp` (6-stelliger Code per SMTP)

**Hinweis:** `002` ist nur nötig, wenn die Datenbank bereits mit `001` ohne die neuen Spalten angelegt wurde. Bei einem **frischen** Setup aus `001_initial.sql` (inkl. `legal_name`, …) kann `002` übersprungen werden.

**SMTP (E-Mail-Code):** Im Backend `SMTP_HOST`, `SMTP_PORT`, optional `SMTP_USER` / `SMTP_PASS`, `SMTP_FROM`, `SMTP_FROM_NAME`. Ohne `SMTP_HOST` wird der Code nur ins Server-Log geschrieben (Entwicklung).
