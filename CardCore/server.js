require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const { errorHandler } = require("./middleware/errorHandler");
const appConfigController = require("./controllers/appConfigController");

const authRoutes = require("./routes/auth");
const usersRoutes = require("./routes/users");
const listingsRoutes = require("./routes/listings");
const favoritesRoutes = require("./routes/favorites");
const conversationsRoutes = require("./routes/conversations");
const reviewsRoutes = require("./routes/reviews");
const aiRoutes = require("./routes/ai");
const supportRoutes = require("./routes/support");
const adminRoutes = require("./routes/admin");
const publicStatsRoutes = require("./routes/publicStats");
const offersRoutes = require("./routes/offers");
const dealsRoutes = require("./routes/deals");
const privateMarketRoutes = require("./routes/privateMarket");

const app = express();
const port = Number(process.env.PORT) || 3000;

/**
 * Hinter einem Reverse-Proxy (Railway, Render, Fly, Heroku) setzt der Proxy
 * X-Forwarded-For — dann muss Express "trust proxy" kennen, sonst wirft
 * express-rate-limit ERR_ERL_UNEXPECTED_X_FORWARDED_FOR.
 */
function resolveTrustProxy() {
  const raw = String(process.env.TRUST_PROXY ?? "").trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "no") {
    return false;
  }
  if (raw === "1" || raw === "true" || raw === "yes") {
    return 1;
  }
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 0) {
    return n;
  }
  if (
    process.env.RAILWAY_ENVIRONMENT ||
    process.env.FLY_APP_NAME ||
    process.env.RENDER ||
    process.env.HEROKU_APP_NAME
  ) {
    return 1;
  }
  return false;
}

const trustProxy = resolveTrustProxy();
if (trustProxy !== false) {
  app.set("trust proxy", trustProxy);
}

const corsOriginsRaw = process.env.CORS_ORIGINS;
const corsOrigins =
  corsOriginsRaw && String(corsOriginsRaw).trim().length > 0
    ? String(corsOriginsRaw)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : null;

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(
  cors({
    origin:
      corsOrigins && corsOrigins.length > 0 ? corsOrigins : true,
    credentials: true,
  })
);
/* Zwei Foto-Base64 + JSON brauchen mehr als 15mb (KI-Analyse). */
app.use(express.json({ limit: "40mb" }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 80,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Zu viele Anfragen. Bitte später erneut versuchen." },
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Zu viele KI-Anfragen. Bitte kurz warten." },
});

const privateMarketRedeemLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Zu viele Versuche. Bitte später erneut." },
});

app.use("/api/auth", authLimiter);
app.use("/api/ai", aiLimiter);

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "vurex-backend",
    time: new Date().toISOString(),
  });
});

app.get("/api/app/status", appConfigController.publicStatus);

app.use("/api/public", publicStatsRoutes);

app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use(
  "/api/private-market",
  privateMarketRedeemLimiter,
  privateMarketRoutes
);
app.use("/api/listings", listingsRoutes);
app.use("/api/favorites", favoritesRoutes);
app.use("/api/conversations", conversationsRoutes);
app.use("/api/offers", offersRoutes);
app.use("/api/deals", dealsRoutes);
app.use("/api/reviews", reviewsRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/admin", adminRoutes);
app.use("/admin", express.static(path.join(__dirname, "admin")));

app.use((req, res) => {
  res.status(404).json({ error: "Nicht gefunden." });
});

app.use(errorHandler);

app.listen(port, () => {
  console.log(`VUREX API auf Port ${port}`);
});
