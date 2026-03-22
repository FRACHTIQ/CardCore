const express = require("express");
const { pool } = require("../db");
const { authRequired } = require("../middleware/auth");

const router = express.Router();

router.use(authRequired);

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, title, body, created_at, updated_at
       FROM card
       WHERE user_id = $1
       ORDER BY updated_at DESC`,
      [req.userId]
    );
    return res.json({ cards: result.rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Serverfehler." });
  }
});

router.post("/", async (req, res) => {
  const title = String(req.body.title || "").trim();
  const body = String(req.body.body || "").trim();

  if (!title) {
    return res.status(400).json({ error: "Titel erforderlich." });
  }

  try {
    const result = await pool.query(
      `INSERT INTO card (user_id, title, body)
       VALUES ($1, $2, $3)
       RETURNING id, title, body, created_at, updated_at`,
      [req.userId, title, body]
    );
    return res.status(201).json({ card: result.rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Serverfehler." });
  }
});

router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const title = String(req.body.title || "").trim();
  const bodyText = String(req.body.body || "").trim();

  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: "Ungültige ID." });
  }
  if (!title) {
    return res.status(400).json({ error: "Titel erforderlich." });
  }

  try {
    const result = await pool.query(
      `UPDATE card
       SET title = $1, body = $2, updated_at = NOW()
       WHERE id = $3 AND user_id = $4
       RETURNING id, title, body, created_at, updated_at`,
      [title, bodyText, id, req.userId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Nicht gefunden." });
    }
    return res.json({ card: result.rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Serverfehler." });
  }
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: "Ungültige ID." });
  }

  try {
    const result = await pool.query(
      `DELETE FROM card WHERE id = $1 AND user_id = $2`,
      [id, req.userId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Nicht gefunden." });
    }
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Serverfehler." });
  }
});

module.exports = router;
