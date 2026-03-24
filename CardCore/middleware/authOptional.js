const jwt = require("jsonwebtoken");

function authOptional(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    req.userId = null;
    next();
    return;
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const id = Number(payload.sub);
    req.userId =
      Number.isInteger(id) && id >= 1 ? id : null;
  } catch {
    req.userId = null;
  }
  next();
}

module.exports = { authOptional };
