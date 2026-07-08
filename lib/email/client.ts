/**
 * Transactional-email transport (Stage 13, PRD §11). Supports two backends and
 * picks whichever is configured, SMTP first:
 *
 *   1. SMTP (e.g. Gmail) — set `EMAIL_SERVER_HOST` / `EMAIL_SERVER_PORT` /
 *      `EMAIL_SERVER_USER` / `EMAIL_SERVER_PASSWORD` / `EMAIL_FROM`. Uses nodemailer.
 *      Gmail requires the From address to be the authenticated account (or a verified
 *      alias), so `EMAIL_FROM` should equal `EMAIL_SERVER_USER`, and the password must
 *      be a Gmail *App Password* (16 chars), not the account password.
 *   2. Resend HTTP API — set `RESEND_API_KEY` (+ optional `RESEND_FROM_EMAIL`).
 *
 * ### Graceful degradation
 * Mirrors `isDbConfigured()` / `isCloudinaryConfigured()` / `isPaymentProcessorConfigured()`:
 * with neither backend configured, `isEmailConfigured()` is false and the notification
 * layer (`./notifications`) no-ops, so checkout still completes with zero
 * infrastructure (Part-A behaviour). Set the env vars and real sends take over
 * with no call-site changes.
 */
import type { Transporter } from "nodemailer";

// --- SMTP (nodemailer) ---
const SMTP_HOST = process.env.EMAIL_SERVER_HOST;
const SMTP_PORT = Number(process.env.EMAIL_SERVER_PORT || 465);
const SMTP_USER = process.env.EMAIL_SERVER_USER;
const SMTP_PASSWORD = process.env.EMAIL_SERVER_PASSWORD;

// --- Resend (HTTP) ---
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_ENDPOINT = "https://api.resend.com/emails";

// Shared "From" address. Prefer the SMTP `EMAIL_FROM`, fall back to Resend's, then a
// last-resort placeholder (only ever hit when a caller sends while unconfigured).
const FROM_EMAIL =
  process.env.EMAIL_FROM || process.env.RESEND_FROM_EMAIL || SMTP_USER || "orders@ourapp.com";

/** SMTP is usable only with host + user + password all present. */
function isSmtpConfigured(): boolean {
  return Boolean(SMTP_HOST && SMTP_USER && SMTP_PASSWORD);
}

/** True when EITHER backend is configured; gates the real-vs-noop send path. */
export function isEmailConfigured(): boolean {
  return isSmtpConfigured() || Boolean(RESEND_API_KEY);
}

/** Lazily-built, reused SMTP transporter (nodemailer is imported only when SMTP is
 *  actually used, so non-email code paths never pull it into their bundle). */
let transporter: Transporter | null = null;
async function getTransporter(): Promise<Transporter> {
  if (!transporter) {
    const { createTransport } = await import("nodemailer");
    transporter = createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      // Port 465 = implicit TLS (SMTPS); 587/25 = STARTTLS.
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
    });
  }
  return transporter;
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
 * Low-level send. Routes through SMTP when configured, otherwise Resend. Throws if
 * neither backend is configured (callers gate on `isEmailConfigured()`), on a network
 * error, or on a non-2xx response. The higher-level notification helpers
 * (`./notifications`) catch these so a mail failure never blocks the originating action.
 */
export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  const from = message.fromName
    ? `${sanitizeFromName(message.fromName)} <${FROM_EMAIL}>`
    : FROM_EMAIL;

  if (isSmtpConfigured()) {
    const tx = await getTransporter();
    const info = await tx.sendMail({
      from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      ...(message.replyTo ? { replyTo: message.replyTo } : {}),
    });
    return { id: info.messageId ?? "" };
  }

  if (!RESEND_API_KEY) {
    throw new Error("Email is not configured (set EMAIL_SERVER_* for SMTP or RESEND_API_KEY).");
  }

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
