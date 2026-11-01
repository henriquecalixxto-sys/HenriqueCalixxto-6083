/**
 * Transactional mail for security-critical flows (password reset).
 *
 * Provider-agnostic: it speaks the Resend HTTP API when RESEND_API_KEY is
 * present. There is no fallback that pretends to succeed — a password reset
 * that silently goes nowhere looks identical to a working one from the user's
 * side, and that gap is exactly how an account becomes permanently
 * unrecoverable. In development the message is printed to the server console
 * so the flow can be exercised without a provider.
 */

const isProd = process.env.NODE_ENV === "production";

export function mailerConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
}

async function send(opts: { to: string; subject: string; text: string; html: string }) {
  if (!mailerConfigured()) {
    if (isProd) {
      // Surfaces as an opaque 500 to the client; the operator sees this line.
      console.error("[mailer] BLOCKED: RESEND_API_KEY / MAIL_FROM not configured in production");
      throw new Error("Email provider is not configured");
    }
    console.warn(`[mailer] (dev, not sent) to=${opts.to} subject="${opts.subject}"\n${opts.text}`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.MAIL_FROM,
      to: [opts.to],
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    }),
  });

  if (!res.ok) {
    // Never echo the provider's response body to the caller — it can contain
    // account metadata. Log it, raise a generic error.
    console.error("[mailer] provider rejected the message", res.status, await res.text().catch(() => ""));
    throw new Error("Email delivery failed");
  }
}

export async function sendPasswordResetEmail(to: string, url: string) {
  const subject = "Reset your Calixto Agency password";
  const text = [
    "We received a request to reset the password on your Calixto Agency account.",
    "",
    `Reset link (valid for 15 minutes, single use): ${url}`,
    "",
    "If you did not request this, you can ignore this email — your password will not change.",
    "Calixto Agency · 4 Worth Street, Bridgeport, CT 06606 · (475) 449-4306",
  ].join("\n");

  const html = `<div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;color:#0a0a0a">
  <p style="letter-spacing:.18em;font-size:11px;color:#8a7a52;margin:0 0 24px">CALIXTO AGENCY</p>
  <h1 style="font-size:22px;font-weight:400;margin:0 0 16px">Reset your password</h1>
  <p style="line-height:1.7;color:#3a3a3a">We received a request to reset the password on your account. This link is valid for 15 minutes and can be used once.</p>
  <p style="margin:28px 0"><a href="${url}" style="background:#0a0a0a;color:#fff;padding:14px 26px;text-decoration:none;letter-spacing:.12em;font-size:12px">RESET PASSWORD</a></p>
  <p style="line-height:1.7;color:#6a6a6a;font-size:13px">If you did not request this, ignore this email — your password will not change.</p>
  <p style="color:#8a8a8a;font-size:11px;margin-top:32px">Calixto Agency · 4 Worth Street, Bridgeport, CT 06606 · (475) 449-4306</p>
</div>`;

  await send({ to, subject, text, html });
}
