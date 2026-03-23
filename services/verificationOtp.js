const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { query } = require("../db");

const OTP_TTL_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const RESEND_COOLDOWN_MS = 60 * 1000;

function generateSixDigitCode() {
  const n = crypto.randomInt(0, 1_000_000);
  return String(n).padStart(6, "0");
}

/**
 * Legt OTP an oder ersetzt vorhandenes, sendet keine Mail.
 * @param {number} userId
 * @param {string} plainCode
 */
async function storeOtp(userId, plainCode) {
  const hash = await bcrypt.hash(plainCode, 10);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  await query(
    `INSERT INTO email_verification_otp (user_id, code_hash, expires_at, attempts, created_at)
     VALUES ($1, $2, $3, 0, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       code_hash = EXCLUDED.code_hash,
       expires_at = EXCLUDED.expires_at,
       attempts = 0,
       created_at = NOW()`,
    [userId, hash, expiresAt.toISOString()]
  );
}

/**
 * @param {number} userId
 * @returns {Promise<{ ok: true } | { ok: false, reason: string }>}
 */
async function verifyOtp(userId, rawCode) {
  const digits = String(rawCode || "").replace(/\D/g, "").slice(0, 6);
  if (digits.length !== 6) {
    return { ok: false, reason: "invalid_format" };
  }

  const rowRes = await query(
    `SELECT code_hash, expires_at, attempts FROM email_verification_otp WHERE user_id = $1`,
    [userId]
  );
  const row = rowRes.rows[0];
  if (!row) {
    return { ok: false, reason: "no_code" };
  }
  const expires = row.expires_at ? new Date(row.expires_at).getTime() : 0;
  if (!expires || Date.now() > expires) {
    await query(`DELETE FROM email_verification_otp WHERE user_id = $1`, [
      userId,
    ]);
    return { ok: false, reason: "expired" };
  }
  const attempts = Number(row.attempts) || 0;
  if (attempts >= MAX_ATTEMPTS) {
    await query(`DELETE FROM email_verification_otp WHERE user_id = $1`, [
      userId,
    ]);
    return { ok: false, reason: "locked" };
  }

  const match = await bcrypt.compare(digits, row.code_hash);
  if (!match) {
    await query(
      `UPDATE email_verification_otp SET attempts = attempts + 1 WHERE user_id = $1`,
      [userId]
    );
    return { ok: false, reason: "mismatch" };
  }

  await query(`DELETE FROM email_verification_otp WHERE user_id = $1`, [
    userId,
  ]);
  return { ok: true };
}

/**
 * @param {number} userId
 * @returns {Promise<{ ok: true } | { ok: false, reason: string, waitSec?: number }>}
 */
async function canResend(userId) {
  const r = await query(
    `SELECT created_at FROM email_verification_otp WHERE user_id = $1`,
    [userId]
  );
  const row = r.rows[0];
  if (!row || !row.created_at) {
    return { ok: true };
  }
  const created = new Date(row.created_at).getTime();
  const elapsed = Date.now() - created;
  if (elapsed < RESEND_COOLDOWN_MS) {
    const waitSec = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
    return { ok: false, reason: "cooldown", waitSec };
  }
  return { ok: true };
}

module.exports = {
  generateSixDigitCode,
  storeOtp,
  verifyOtp,
  canResend,
  OTP_TTL_MS,
  RESEND_COOLDOWN_MS,
};
