const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { query } = require("../db");
const { HttpError } = require("../utils/httpError");
const { sendWelcomeDmToNewUser } = require("../services/welcomeDm");
const { sendEmailVerificationCode } = require("../services/mailer");
const {
  generateSixDigitCode,
  storeOtp,
  verifyOtp,
  canResend,
} = require("../services/verificationOtp");

function signToken(userId) {
  return jwt.sign(
    { sub: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

function userNeedsEmailVerification(row) {
  return row && (row.email_verified_at == null || row.email_verified_at === "");
}

async function issueOtpAndSendEmail(userRow) {
  const code = generateSixDigitCode();
  await storeOtp(userRow.id, code);
  await sendEmailVerificationCode({
    to: userRow.email,
    displayName: userRow.display_name,
    code,
  });
}

/** Sendet einen neuen Code, wenn kein gültiges OTP mehr existiert (z. B. abgelaufen). */
async function ensureVerificationEmailIfStale(userRow) {
  if (!userNeedsEmailVerification(userRow)) {
    return;
  }
  const r = await query(
    `SELECT expires_at FROM email_verification_otp WHERE user_id = $1`,
    [userRow.id]
  );
  const row = r.rows[0];
  if (!row || !row.expires_at) {
    await issueOtpAndSendEmail(userRow);
    return;
  }
  const exp = new Date(row.expires_at).getTime();
  if (!exp || Date.now() > exp) {
    await issueOtpAndSendEmail(userRow);
  }
}

async function register(req, res, next) {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const displayName = String(req.body.display_name || "").trim();
    const acceptTerms =
      req.body.accept_terms === true ||
      req.body.accept_terms === "true" ||
      req.body.accept_terms === 1;

    if (!email || !password) {
      throw new HttpError(400, "E-Mail und Passwort erforderlich.");
    }
    if (!acceptTerms) {
      throw new HttpError(400, "Die AGB müssen akzeptiert werden.");
    }
    if (password.length < 8) {
      throw new HttpError(400, "Passwort mindestens 8 Zeichen.");
    }
    if (!displayName) {
      throw new HttpError(400, "Anzeigename erforderlich.");
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await query(
      `INSERT INTO app_user (email, password_hash, display_name, terms_accepted_at, email_verified_at)
       VALUES ($1, $2, $3, NOW(), NULL)
       RETURNING id, email, display_name, role, created_at, private_market_access, email_verified_at`,
      [email, hash, displayName]
    );
    const user = result.rows[0];
    const token = signToken(user.id);
    let welcomeDm = { sent: false, reason: "error" };
    try {
      welcomeDm = await sendWelcomeDmToNewUser(user.id);
    } catch (e) {
      console.error("[auth] welcome DM:", e && e.stack ? e.stack : e);
      welcomeDm = { sent: false, reason: "exception" };
    }

    let verification_mail_sent = true;
    try {
      await issueOtpAndSendEmail(user);
    } catch (e) {
      verification_mail_sent = false;
      console.error("[auth] verification mail:", e && e.stack ? e.stack : e);
    }

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        role: user.role || "user",
        private_market_access: Boolean(user.private_market_access),
        email_verified_at: user.email_verified_at,
      },
      token,
      welcome_dm: welcomeDm,
      requires_email_verification: userNeedsEmailVerification(user),
      verification_mail_sent,
    });
  } catch (err) {
    if (err.code === "23505") {
      next(new HttpError(409, "E-Mail ist bereits registriert."));
      return;
    }
    if (err.code === "42703" || /email_verified_at/i.test(String(err.message))) {
      next(
        new HttpError(
          500,
          "Datenbank-Migration 017 (email_verified_at) fehlt. Bitte SQL ausführen."
        )
      );
      return;
    }
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!email || !password) {
      throw new HttpError(400, "E-Mail und Passwort erforderlich.");
    }

    const result = await query(
      `SELECT id, email, password_hash, display_name, role, suspended_at, private_market_access, email_verified_at
       FROM app_user WHERE email = $1`,
      [email]
    );
    const user = result.rows[0];
    if (!user) {
      throw new HttpError(401, "Ungültige Zugangsdaten.");
    }
    if (user.suspended_at) {
      throw new HttpError(403, "Konto gesperrt.");
    }
    if (!user.password_hash) {
      throw new HttpError(401, "Ungültige Zugangsdaten.");
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      throw new HttpError(401, "Ungültige Zugangsdaten.");
    }
    if (userNeedsEmailVerification(user)) {
      try {
        await ensureVerificationEmailIfStale(user);
      } catch (e) {
        console.error(
          "[auth] login verification mail:",
          e && e.stack ? e.stack : e
        );
      }
    }
    const token = signToken(user.id);
    res.json({
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        role: user.role || "user",
        private_market_access: Boolean(user.private_market_access),
        email_verified_at: user.email_verified_at,
      },
      token,
      requires_email_verification: userNeedsEmailVerification(user),
    });
  } catch (err) {
    next(err);
  }
}

async function verifyEmail(req, res, next) {
  try {
    const raw = req.body && req.body.code;
    const outcome = await verifyOtp(req.userId, raw);
    if (!outcome.ok) {
      throw new HttpError(
        400,
        "Code ungültig oder abgelaufen. Bitte neuen Code anfordern."
      );
    }
    await query(
      `UPDATE app_user SET email_verified_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [req.userId]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function resendVerification(req, res, next) {
  try {
    const u = await query(
      `SELECT id, email, display_name, email_verified_at FROM app_user WHERE id = $1`,
      [req.userId]
    );
    const user = u.rows[0];
    if (!user) {
      throw new HttpError(404, "Benutzer nicht gefunden.");
    }
    if (!userNeedsEmailVerification(user)) {
      throw new HttpError(400, "E-Mail ist bereits bestätigt.");
    }
    const cool = await canResend(req.userId);
    if (!cool.ok && cool.reason === "cooldown") {
      throw new HttpError(
        429,
        `Bitte ${cool.waitSec || 60} Sekunden warten, bevor du erneut einen Code anforderst.`
      );
    }
    await issueOtpAndSendEmail(user);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  login,
  verifyEmail,
  resendVerification,
};
