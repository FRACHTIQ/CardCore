const { query, withTransaction } = require("../db");
const { HttpError } = require("../utils/httpError");

const SUBJECT_MAX = 200;
const BODY_MAX = 8000;

function clip(s, max) {
  return String(s ?? "")
    .trim()
    .slice(0, max);
}

async function createTicket(req, res, next) {
  try {
    const subject = clip(req.body.subject, SUBJECT_MAX);
    const body = clip(req.body.body, BODY_MAX);
    if (!subject) {
      throw new HttpError(400, "Betreff erforderlich.");
    }
    if (!body) {
      throw new HttpError(400, "Nachricht erforderlich.");
    }

    const ticketId = await withTransaction(async (client) => {
      const tRes = await client.query(
        `INSERT INTO support_ticket (user_id, subject, status)
         VALUES ($1, $2, 'OPEN')
         RETURNING id`,
        [req.userId, subject]
      );
      const id = tRes.rows[0].id;
      await client.query(
        `INSERT INTO support_message (ticket_id, from_user, body)
         VALUES ($1, TRUE, $2)`,
        [id, body]
      );
      return id;
    });

    const row = await query(
      `SELECT id, user_id, subject, status, created_at, updated_at
       FROM support_ticket WHERE id = $1`,
      [ticketId]
    );
    res.status(201).json({ ticket: row.rows[0] });
  } catch (err) {
    next(err);
  }
}

async function listTickets(req, res, next) {
  try {
    const result = await query(
      `SELECT
         t.id,
         t.subject,
         t.status,
         t.created_at,
         t.updated_at,
         (SELECT body FROM support_message m
          WHERE m.ticket_id = t.id
          ORDER BY m.created_at DESC
          LIMIT 1) AS last_message_preview,
         (SELECT COUNT(*)::int FROM support_message m WHERE m.ticket_id = t.id) AS message_count
       FROM support_ticket t
       WHERE t.user_id = $1
       ORDER BY t.updated_at DESC`,
      [req.userId]
    );
    res.json({ tickets: result.rows });
  } catch (err) {
    next(err);
  }
}

async function getTicket(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      throw new HttpError(400, "Ungültige Ticket-ID.");
    }
    const tRes = await query(
      `SELECT id, user_id, subject, status, created_at, updated_at
       FROM support_ticket WHERE id = $1 AND user_id = $2`,
      [id, req.userId]
    );
    const ticket = tRes.rows[0];
    if (!ticket) {
      throw new HttpError(404, "Ticket nicht gefunden.");
    }
    const mRes = await query(
      `SELECT id, from_user, body, created_at
       FROM support_message
       WHERE ticket_id = $1
       ORDER BY created_at ASC`,
      [id]
    );
    res.json({ ticket, messages: mRes.rows });
  } catch (err) {
    next(err);
  }
}

async function addUserMessage(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      throw new HttpError(400, "Ungültige Ticket-ID.");
    }
    const body = clip(req.body.body, BODY_MAX);
    if (!body) {
      throw new HttpError(400, "Nachricht erforderlich.");
    }

    const check = await query(
      `SELECT id, status FROM support_ticket WHERE id = $1 AND user_id = $2`,
      [id, req.userId]
    );
    const row = check.rows[0];
    if (!row) {
      throw new HttpError(404, "Ticket nicht gefunden.");
    }
    if (row.status === "CLOSED") {
      throw new HttpError(400, "Dieses Ticket ist geschlossen.");
    }

    await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO support_message (ticket_id, from_user, body)
         VALUES ($1, TRUE, $2)`,
        [id, body]
      );
      await client.query(
        `UPDATE support_ticket
         SET status = 'WAITING_STAFF', updated_at = NOW()
         WHERE id = $1`,
        [id]
      );
    });

    const mRes = await query(
      `SELECT id, from_user, body, created_at
       FROM support_message
       WHERE ticket_id = $1
       ORDER BY created_at ASC`,
      [id]
    );
    res.json({ messages: mRes.rows });
  } catch (err) {
    next(err);
  }
}

/** Antwort durch Support (Backend / Postman); Header: X-Support-Admin-Secret */
async function staffReply(req, res, next) {
  try {
    const secret = process.env.SUPPORT_ADMIN_SECRET;
    const hdr = req.headers["x-support-admin-secret"];
    if (!secret || hdr !== secret) {
      throw new HttpError(404, "Nicht gefunden.");
    }
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      throw new HttpError(400, "Ungültige Ticket-ID.");
    }
    const body = clip(req.body.body, BODY_MAX);
    if (!body) {
      throw new HttpError(400, "Nachricht erforderlich.");
    }

    const check = await query(`SELECT id FROM support_ticket WHERE id = $1`, [id]);
    if (!check.rows[0]) {
      throw new HttpError(404, "Ticket nicht gefunden.");
    }

    await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO support_message (ticket_id, from_user, body)
         VALUES ($1, FALSE, $2)`,
        [id, body]
      );
      await client.query(
        `UPDATE support_ticket
         SET status = 'ANSWERED', updated_at = NOW()
         WHERE id = $1`,
        [id]
      );
    });

    const mRes = await query(
      `SELECT id, from_user, body, created_at
       FROM support_message
       WHERE ticket_id = $1
       ORDER BY created_at ASC`,
      [id]
    );
    res.json({ messages: mRes.rows });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createTicket,
  listTickets,
  getTicket,
  addUserMessage,
  staffReply,
};
