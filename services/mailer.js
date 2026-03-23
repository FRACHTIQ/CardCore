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
 * Helles, sachliches Layout (Marktplatz-App) — tabellenbasiert für Mail-Clients.
 */
function buildVerificationEmailHtml(displayName, code) {
  const safeName = escapeHtml(displayName);
  const safeCode = escapeHtml(code);
  const ff =
    "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>VUREX – E-Mail bestätigen</title>
</head>
<body style="margin:0;padding:0;background-color:#ebebe8;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ebebe8;border-collapse:collapse;">
  <tr>
    <td align="center" style="padding:40px 16px 48px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;border-collapse:collapse;">
        <tr>
          <td style="padding:0 4px 20px;">
            <p style="margin:0;font-family:${ff};font-size:22px;font-weight:800;letter-spacing:-0.03em;color:#1a1a1a;line-height:1.2;">VUREX</p>
            <p style="margin:6px 0 0;font-family:${ff};font-size:13px;font-weight:500;line-height:1.4;color:#5c5c5c;">Marktplatz für Sammelkarten</p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#ffffff;border:1px solid #e0e0dd;border-radius:12px;padding:0;overflow:hidden;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
              <tr>
                <td style="height:4px;background-color:#1a1a1a;line-height:4px;font-size:0;">&nbsp;</td>
              </tr>
              <tr>
                <td style="padding:28px 24px 26px;">
                  <p style="margin:0 0 6px;font-family:${ff};font-size:12px;font-weight:700;color:#8e8e8e;text-transform:uppercase;letter-spacing:0.06em;">Sicherheit</p>
                  <p style="margin:0 0 18px;font-family:${ff};font-size:18px;font-weight:700;line-height:1.3;color:#1a1a1a;">E-Mail-Adresse bestätigen</p>
                  <p style="margin:0 0 16px;font-family:${ff};font-size:15px;line-height:1.55;color:#3d3d3d;">Hallo ${safeName},</p>
                  <p style="margin:0 0 12px;font-family:${ff};font-size:15px;line-height:1.55;color:#5c5c5c;">Bitte gib den folgenden Code in der <strong style="color:#1a1a1a;font-weight:600;">VUREX-App</strong> ein:</p>
                  <p style="margin:0 0 18px;font-family:${ff};font-size:13px;line-height:1.55;color:#8e8e8e;">Kleener Berliner Gruß: Willkommen bei VUREX - jut, dass du da bist.</p>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 20px;">
                    <tr>
                      <td align="center" style="background-color:#f5f5f1;border:1px solid #e0e0dd;border-radius:10px;padding:18px 12px;">
                        <span style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:26px;font-weight:700;letter-spacing:0.28em;color:#1a1a1a;">${safeCode}</span>
                      </td>
                    </tr>
                  </table>
                  <p style="margin:0;font-family:${ff};font-size:13px;line-height:1.6;color:#8e8e8e;">Der Code ist <strong style="color:#5c5c5c;font-weight:600;">15&nbsp;Minuten</strong> gültig. Wenn du kein Konto bei VUREX angelegt hast, kannst du diese E-Mail löschen.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:22px 8px 0;font-family:${ff};font-size:11px;line-height:1.55;color:#8e8e8e;text-align:center;">
            VUREX GmbH · Service-Nachricht<br>
            <span style="color:#b0b0ac;">Automatisch versendet · bitte nicht antworten</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
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
    "VUREX · E-Mail bestätigen",
    "",
    `Hallo ${displayName},`,
    "Kleener Berliner Gruß: Willkommen bei VUREX - jut, dass du da bist.",
    "",
    `Dein Bestätigungscode: ${code}`,
    "",
    "Gültig für 15 Minuten. Wenn du dich nicht bei VUREX registriert hast, ignoriere diese E-Mail.",
    "",
    "— VUREX",
  ].join("\n");

  const html = buildVerificationEmailHtml(displayName, code);

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
