require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const cardsRoutes = require("./routes/cards");
const reviewsRoutes = require("./routes/reviews");
const profileRoutes = require("./routes/profile");
const listingsRoutes = require("./routes/listings");
const conversationsRoutes = require("./routes/conversations");
const moderationRoutes = require("./routes/moderation");
const adminRoutes = require("./routes/admin");
const pushTokensRoutes = require("./routes/pushTokens");
const usersRoutes = require("./routes/users");

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/cards", cardsRoutes);
app.use("/api/reviews", reviewsRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/listings", listingsRoutes);
app.use("/api/conversations", conversationsRoutes);
app.use("/api/moderation", moderationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/push-tokens", pushTokensRoutes);
app.use("/api/users", usersRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Nicht gefunden." });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status =
    err && typeof err.status === "number" && err.status >= 400 && err.status < 600
      ? err.status
      : 500;
  const message =
    status >= 500 ? "Serverfehler." : err.message || "Fehler.";
  if (status >= 500) {
    console.error(err);
  }
  res.status(status).json({ error: message });
});

app.listen(port, () => {
  console.log(`Server läuft auf Port ${port}`);
});
