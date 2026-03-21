require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");

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

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json({ limit: "15mb" }));

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "cardcore-backend" });
});

app.get("/api/app/status", appConfigController.publicStatus);

app.use("/api/public", publicStatsRoutes);

app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
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
  console.log(`CardCore API auf Port ${port}`);
});
