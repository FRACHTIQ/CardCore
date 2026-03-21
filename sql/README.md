# Datenbank-Migrationen

Reihenfolge in PostgreSQL (z. B. Railway):

1. `001_initial.sql` – Schema (falls noch nicht ausgeführt)
2. `002_profile_trade.sql` – Handels-/Versandfelder auf `app_user`

**Hinweis:** `002` ist nur nötig, wenn die Datenbank bereits mit `001` ohne die neuen Spalten angelegt wurde. Bei einem **frischen** Setup aus `001_initial.sql` (inkl. `legal_name`, …) kann `002` übersprungen werden.
