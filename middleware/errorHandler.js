function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    next(err);
    return;
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
