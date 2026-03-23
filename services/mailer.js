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
 * Dunkles, reduziertes Layout — tabellenbasiert für gängige Mail-Clients.
 */
function buildVerificationEmailHtml(displayName, code) {
  const safeName = escapeHtml(displayName);
  const safeCode = escapeHtml(code);
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>VUREX – E-Mail bestätigen</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0c;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0c;border-collapse:collapse;">
  <tr>
    <td align="center" style="padding:48px 20px 56px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;border-collapse:collapse;">
        <tr>
          <td align="center" style="padding:0 0 28px;">
            <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.35em;color:rgba(255,255,255,0.45);text-transform:uppercase;">Sammlerbörse</span>
            <div style="font-family:Georgia,'Times New Roman',serif;font-size:32px;font-weight:700;font-style:italic;letter-spacing:-0.02em;color:#ffffff;margin-top:10px;">VUREX</div>
          </td>
        </tr>
        <tr>
          <td style="background-color:#12131a;border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:0;overflow:hidden;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
              <tr>
                <td style="height:3px;background-color:#ffffff;line-height:3px;font-size:0;">&nbsp;</td>
              </tr>
              <tr>
                <td style="padding:36px 32px 32px;">
                  <p style="margin:0 0 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.5);">E-Mail bestätigen</p>
                  <p style="margin:0 0 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:20px;font-weight:600;line-height:1.35;color:#f4f4f5;">Hallo ${safeName},</p>
                  <p style="margin:0 0 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:rgba(255,255,255,0.72);">Nutze diesen Code in der App, um deine E-Mail-Adresse zu bestätigen:</p>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 24px;">
                    <tr>
                      <td align="center" style="background-color:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:14px;padding:22px 16px;">
                        <span style="font-family:'SF Mono',ui-monospace,Menlo,Consolas,monospace;font-size:30px;font-weight:700;letter-spacing:0.45em;color:#ffffff;">${safeCode}</span>
                      </td>
                    </tr>
                  </table>
                  <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:rgba(255,255,255,0.48);">Gültig für <strong style="color:rgba(255,255,255,0.65);font-weight:600;">15 Minuten</strong>. Wenn du dich nicht bei VUREX registriert hast, kannst du diese E-Mail ignorieren.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:28px 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:rgba(255,255,255,0.35);">
            © VUREX · Sammelkarten handeln<br>
            <span style="color:rgba(255,255,255,0.25);">Diese Nachricht wurde automatisch versendet.</span>
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
