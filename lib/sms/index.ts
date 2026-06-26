/**
 * SMS transport seam (Phase 5) — same env-gated, graceful-degradation contract as
 * the email/Cloudinary/payments seams. With `SMS_PROVIDER` unset, `isSmsConfigured()`
 * is false and the campaign sender no-ops the SMS channel, so the app runs with zero
 * infrastructure. Wired generically (provider + endpoint + token via env) so a
 * Twilio-style REST gateway drops in without call-site changes; no vendor SDK.
 *
 * Server-only.
 */

const SMS_PROVIDER = process.env.SMS_PROVIDER; // e.g. "twilio"
const SMS_ENDPOINT = process.env.SMS_ENDPOINT; // provider's send URL
const SMS_TOKEN = process.env.SMS_AUTH_TOKEN; // bearer/auth token
const SMS_FROM = process.env.SMS_FROM || ""; // sender id / number

/** True when an SMS provider is configured; gates the real-vs-noop send path. */
export function isSmsConfigured(): boolean {
  return Boolean(SMS_PROVIDER && SMS_ENDPOINT && SMS_TOKEN);
}

export interface SmsMessage {
  to: string;
  body: string;
}

export interface SmsResult {
  sent: boolean;
  reason?: string;
  id?: string;
}

/**
 * Send one SMS. Failure-tolerant (never throws) so the campaign loop can await it and
 * tally results. No-ops cleanly when unconfigured.
 */
export async function sendSms(message: SmsMessage): Promise<SmsResult> {
  if (!isSmsConfigured()) return { sent: false, reason: "sms not configured" };
  const to = message.to.trim();
  if (!to) return { sent: false, reason: "no recipient" };

  try {
    const res = await fetch(SMS_ENDPOINT!, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SMS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: SMS_FROM, to, body: message.body.slice(0, 1000) }),
    });
    if (!res.ok) return { sent: false, reason: `provider ${res.status}` };
    const data = (await res.json().catch(() => ({}))) as { id?: string; sid?: string };
    return { sent: true, id: data.id ?? data.sid ?? "" };
  } catch (err) {
    return { sent: false, reason: err instanceof Error ? err.message : "send failed" };
  }
}
