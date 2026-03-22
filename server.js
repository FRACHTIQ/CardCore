require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const cardsRoutes = require("./routes/cards");

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/cards", cardsRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Nicht gefunden." });
});

app.listen(port, () => {
  console.log(`Server läuft auf Port ${port}`);
});
