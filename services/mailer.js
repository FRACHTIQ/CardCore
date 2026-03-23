const nodemailer = require("nodemailer");

function smtpConfigured() {
  return Boolean(String(process.env.SMTP_HOST || "").trim());
}

function createTransport() {
  const host = String(process.env.SMTP_HOST || "").trim();
  if (!host) {
    return null;
  }
  const port = Number(process.env.SMTP_PORT) || 587;
  const secure =
    process.env.SMTP_SECURE === "1" ||
    process.env.SMTP_SECURE === "true" ||
    port === 465;
  const user = String(process.env.SMTP_USER || "").trim();
  const pass = String(process.env.SMTP_PASS || "").trim();
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user ? { user, pass } : undefined,
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {{ to: string, displayName: string, code: string }} opts
 * @returns {Promise<{ sent: boolean, skipped?: boolean }>}
 */
async function sendEmailVerificationCode(opts) {
  const to = String(opts.to || "").trim().toLowerCase();
  const displayName = String(opts.displayName || "").trim() || "VUREX-Nutzer";
  const code = String(opts.code || "").trim();
  if (!to || !code) {
    throw new Error("sendEmailVerificationCode: to/code fehlt.");
  }

  const from =
    String(process.env.SMTP_FROM || process.env.SMTP_USER || "").trim() ||
    "noreply@vurex.local";
  const fromName = String(process.env.SMTP_FROM_NAME || "VUREX").trim();

  const subject = "VUREX – E-Mail bestätigen";
  const text = [
    `Hallo ${displayName},`,
    "",
    `dein Bestätigungscode lautet: ${code}`,
    "",
    "Der Code ist 15 Minuten gültig. Wenn du dich nicht bei VUREX registriert hast, kannst du diese E-Mail ignorieren.",
    "",
    "— VUREX",
  ].join("\n");

  const html = `
  <p>Hallo ${escapeHtml(displayName)},</p>
  <p>dein Bestätigungscode lautet:</p>
  <p style="font-size:28px;font-weight:700;letter-spacing:4px;margin:16px 0;">${escapeHtml(code)}</p>
  <p style="color:#555;font-size:14px;">Der Code ist 15 Minuten gültig. Wenn du dich nicht bei VUREX registriert hast, ignoriere diese E-Mail.</p>
  <p>— VUREX</p>
  `.trim();

  const transporter = createTransport();
  if (!transporter) {
    console.warn(
      "[mail] SMTP nicht konfiguriert (SMTP_HOST …). Code für",
      to,
      ":",
      code
    );
    return { sent: false, skipped: true };
  }

  await transporter.sendMail({
    from: `"${fromName.replace(/"/g, "")}" <${from}>`,
    to,
    subject,
    text,
    html,
  });
  return { sent: true };
}

module.exports = {
  smtpConfigured,
  sendEmailVerificationCode,
};
