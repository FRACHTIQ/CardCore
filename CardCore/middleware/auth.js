const jwt = require("jsonwebtoken");

function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Nicht angemeldet." });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = Number(payload.sub);
    if (!Number.isInteger(req.userId) || req.userId < 1) {
      return res.status(401).json({ error: "Ungültiges Token." });
    }
    next();
  } catch {
    return res.status(401).json({ error: "Ungültiges Token." });
  }
}

module.exports = { authRequired };
