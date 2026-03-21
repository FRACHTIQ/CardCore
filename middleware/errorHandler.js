function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    next(err);
    return;
  }

  /** PostgreSQL: fehlende Spalte/Tabelle (oft Migration nicht ausgeführt) */
  if (err.code === "42703") {
    console.error(err);
    return res.status(500).json({
      error:
        "Datenbankschema nicht aktuell (fehlende Spalte). Bitte in PostgreSQL die Migrationen ausführen, z. B. sql/004_avatar.sql und sql/005_admin.sql (Reihenfolge siehe sql/README.md).",
    });
  }
  if (err.code === "42P01") {
    console.error(err);
    return res.status(500).json({
      error:
        "Datenbankschema nicht aktuell (fehlende Tabelle). Bitte die SQL-Dateien aus sql/ in der richtigen Reihenfolge ausführen.",
    });
  }

  const status = Number.isInteger(err.statusCode) ? err.statusCode : 500;
  const message =
    status === 500 ? "Serverfehler." : err.message || "Fehler.";
  if (status === 500) {
    console.error(err);
  }
  res.status(status).json({ error: message });
}

module.exports = { errorHandler };
