/**
 * Resend transactional-email transport (Stage 13, PRD §11).
 *
 * Server-only. Like the Cloudinary helper (`lib/cloudinary`), we deliberately
 * avoid the vendor SDK: sending an email is a single authenticated POST, so a few
 * lines of `fetch` against Resend's REST API keep the dependency surface (and tsc
 * memory) minimal, matching the project's lean-deps stance.
 *
 * ### Graceful degradation
 * Mirrors `isDbConfigured()` / `isCloudinaryConfigured()` / `isPaymentProcessorConfigured()`:
 * with `RESEND_API_KEY` unset, `isEmailConfigured()` is false and the notification
 * layer (`./notifications`) no-ops, so checkout still completes with zero
 * infrastructure (Part-A behaviour). Set the env vars and real sends take over
 * with no call-site changes.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "orders@ourapp.com";
const RESEND_ENDPOINT = "https://api.resend.com/emails";

/** True when a Resend API key is configured; gates the real-vs-noop send path. */
export function isEmailConfigured(): boolean {
  return Boolean(RESEND_API_KEY);
}

/** A transactional message handed to the transport. */
export interface EmailMessage {
  /** Recipient address. */
  to: string;
  subject: string;
  /** Rendered HTML body. */
  html: string;
  /** Plain-text fallback (required — some clients/filters reject HTML-only mail). */
  text: string;
  /** Optional sender display name (e.g. the store name); the address is env-fixed. */
  fromName?: string;
  /** Optional Reply-To (e.g. the store's contact email). */
  replyTo?: string;
}

/** Outcome of a successful send — `id` is Resend's message id. */
export interface SendResult {
  id: string;
}

/**
 * Low-level send. Throws if unconfigured (callers gate on `isEmailConfigured()`),
 * on a network error, or on a non-2xx Resend response. The higher-level
 * notification helpers (`./notifications`) catch these so a mail failure never
 * blocks the originating action.
 */
export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  if (!RESEND_API_KEY) {
    throw new Error("Resend is not configured (missing RESEND_API_KEY).");
  }

  const from = message.fromName
    ? `${sanitizeFromName(message.fromName)} <${FROM_EMAIL}>`
    : FROM_EMAIL;

  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
      ...(message.replyTo ? { reply_to: message.replyTo } : {}),
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Resend send failed (${res.status}): ${detail.slice(0, 300)}`);
  }

  const data = (await res.json().catch(() => ({}))) as { id?: string };
  return { id: data.id ?? "" };
}

/**
 * A display name in a `From` header can't contain characters that break RFC 5322
 * addressing (quotes, angle brackets, CR/LF). Strip them so a store name like
 * `Bob's "Smoke" Shop` — or a header-injection attempt — can't corrupt the header.
 */
function sanitizeFromName(name: string): string {
  return (
    name
      .replace(/["<>\r\n]/g, "")
      .trim()
      .slice(0, 78) || "Offshelf"
  );
}
