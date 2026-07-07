import type { Order, Store } from "@/types";
import { money, storeDomain } from "@/lib/format";

/**
 * Order-confirmation email template (Stage 13, PRD §11).
 *
 * A pure renderer: `(store, order) → { subject, html, text }`, with no I/O so it
 * stays trivially testable. The body mirrors the on-screen confirmation
 * (`components/storefront/confirmation-view.tsx`) — order number, a line-item
 * echo, total, and the same calm "what happens next" timeline (payment is
 * arranged offline in the MVP — PRD §2.3).
 *
 * ### Why literal hex here (the one place the "no raw hex" rule is lifted)
 * Email clients don't support CSS custom properties, external stylesheets, or web
 * fonts reliably, so transactional mail must use inline styles with literal color
 * values and a system font stack. The hex values below are copied from the brand
 * ramps in `styles/tokens.css` (warm monochrome + lime accent) so the email still
 * reads as the same product; they are intentionally not token references.
 */

export interface OrderConfirmationData {
  store: Pick<Store, "name" | "subdomain" | "settings">;
  order: Pick<
    Order,
    "orderNumber" | "lineItems" | "subtotal" | "total" | "contact" | "shippingAddress"
  >;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/* Brand palette, mirrored from styles/tokens.css (see note above). */
const C = {
  pageBg: "#faf9f5", // warm-50
  surface: "#ffffff", // warm-0
  border: "#e3e0d6", // warm-200
  ink: "#16140e", // warm-900 (strong)
  body: "#2c2920", // warm-800
  muted: "#857f6c", // warm-500
  tint: "#f0f8ce", // lime-100
  tintBorder: "#e2f2a0", // lime-200
  accent: "#97c518", // lime-600 (accent-pressed)
} as const;

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "ui-monospace,'SF Mono',Menlo,Consolas,'Liberation Mono',monospace";

/** The same three reassurances shown on the confirmation screen. */
const NEXT_STEPS = [
  "We confirm stock and delivery window by email",
  "Payment is arranged securely on delivery",
  "Age & ID verified at the door (21+)",
];

/**
 * Passwordless sign-in code email. A calm, single-purpose transactional message: the
 * store name, a big monospaced 6-digit code, and an expiry note. Same inline-style /
 * literal-hex constraints as the order email (see the note at the top of this file).
 */
export function renderLoginCodeEmail(data: {
  storeName: string;
  code: string;
  minutes: number;
}): RenderedEmail {
  const { storeName, code, minutes } = data;
  const subject = `Your ${storeName} sign-in code: ${code}`;
  const html = `<!doctype html><html><body style="margin:0;background:${C.pageBg};font-family:${FONT};color:${C.body};">
  <div style="max-width:440px;margin:0 auto;padding:32px 24px;">
    <div style="background:${C.surface};border:1px solid ${C.border};border-radius:14px;padding:32px 28px;text-align:center;">
      <div style="font-size:13px;letter-spacing:0.06em;text-transform:uppercase;color:${C.muted};margin-bottom:18px;">${esc(storeName)}</div>
      <h1 style="margin:0 0 8px;font-size:20px;color:${C.ink};">Your sign-in code</h1>
      <p style="margin:0 0 22px;font-size:14px;color:${C.muted};">Enter this code to sign in. It expires in ${minutes} minutes.</p>
      <div style="font-family:${MONO};font-size:34px;font-weight:700;letter-spacing:0.32em;color:${C.ink};background:${C.tint};border:1px solid ${C.tintBorder};border-radius:10px;padding:16px 12px 16px 20px;">${esc(code)}</div>
      <p style="margin:22px 0 0;font-size:12px;color:${C.muted};">Didn't request this? You can safely ignore this email — no one can sign in without the code.</p>
    </div>
  </div></body></html>`;
  const text = `${storeName} — your sign-in code is ${code}. It expires in ${minutes} minutes. If you didn't request this, ignore this email.`;
  return { subject, html, text };
}

export function renderOrderConfirmationEmail(data: OrderConfirmationData): RenderedEmail {
  const { store, order } = data;
  const currency = store.settings.currency || "$";
  const orderLabel = `#${order.orderNumber}`;
  const firstName = order.contact.name.trim().split(/\s+/)[0] || "there";
  const homeUrl = `https://${storeDomain(store.subdomain)}`;

  const subject = `Order ${orderLabel} confirmed — ${store.name}`;
  const preheader = `Thanks${firstName ? `, ${firstName}` : ""} — your ${store.name} order ${orderLabel} is confirmed.`;

  return {
    subject,
    html: renderHtml({ store, order, currency, orderLabel, firstName, homeUrl, preheader }),
    text: renderText({ store, order, currency, orderLabel, firstName, homeUrl }),
  };
}

/* ============================================================
   HTML body
   ============================================================ */

interface Ctx {
  store: OrderConfirmationData["store"];
  order: OrderConfirmationData["order"];
  currency: string;
  orderLabel: string;
  firstName: string;
  homeUrl: string;
  preheader: string;
}

function renderHtml(ctx: Ctx): string {
  const { store, order, currency, orderLabel, firstName, homeUrl, preheader } = ctx;

  const itemRows = order.lineItems
    .map((li) => {
      const name = esc(li.title) + (li.variant ? ` · ${esc(li.variant)}` : "");
      return `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid ${C.border};color:${C.body};font-size:14px;line-height:1.4;">
            ${name}
            <span style="color:${C.muted};">× ${li.quantity}</span>
          </td>
          <td align="right" style="padding:10px 0;border-bottom:1px solid ${C.border};color:${C.ink};font-family:${MONO};font-size:14px;white-space:nowrap;">
            ${esc(money(li.price * li.quantity, currency))}
          </td>
        </tr>`;
    })
    .join("");

  const nextSteps = NEXT_STEPS.map(
    (t, i) => `
      <tr>
        <td valign="top" width="22" style="padding:4px 0;color:${C.accent};font-family:${MONO};font-size:14px;">${i + 1}.</td>
        <td style="padding:4px 0;color:${C.body};font-size:14px;line-height:1.5;">${esc(t)}</td>
      </tr>`,
  ).join("");

  const shipTo = [esc(order.shippingAddress.name), esc(order.shippingAddress.address)]
    .filter(Boolean)
    .join("<br>");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${esc(ctx.orderLabel)} confirmed</title>
</head>
<body style="margin:0;padding:0;background:${C.pageBg};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.pageBg};">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

        <!-- Store name -->
        <tr><td style="padding:0 4px 20px;font-family:${FONT};font-size:18px;font-weight:700;letter-spacing:-0.01em;color:${C.ink};">${esc(store.name)}</td></tr>

        <!-- Card -->
        <tr><td style="background:${C.surface};border:1px solid ${C.border};border-radius:14px;padding:32px;font-family:${FONT};">

          <!-- Lime check badge -->
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td width="44" height="44" align="center" valign="middle" style="background:${C.tint};border:1px solid ${C.tintBorder};border-radius:22px;color:${C.accent};font-size:22px;font-weight:700;line-height:1;">✓</td>
          </tr></table>

          <h1 style="margin:20px 0 8px;font-size:22px;font-weight:700;letter-spacing:-0.01em;color:${C.ink};">Order placed</h1>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:${C.body};">
            Thanks, ${esc(firstName)}. Your order
            <span style="font-family:${MONO};color:${C.ink};font-weight:500;">${esc(orderLabel)}</span>
            is confirmed. We'll email you shortly to arrange delivery and payment.
          </p>

          <!-- Line items -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${itemRows}
            <tr>
              <td style="padding:14px 0 0;font-size:14px;color:${C.muted};">Subtotal</td>
              <td align="right" style="padding:14px 0 0;font-family:${MONO};font-size:14px;color:${C.body};">${esc(money(order.subtotal, currency))}</td>
            </tr>
            <tr>
              <td style="padding:6px 0 0;font-size:15px;font-weight:700;color:${C.ink};">Total</td>
              <td align="right" style="padding:6px 0 0;font-family:${MONO};font-size:15px;font-weight:700;color:${C.ink};">${esc(money(order.total, currency))}</td>
            </tr>
          </table>

          <!-- Ship to -->
          <div style="margin-top:24px;padding:16px;background:${C.pageBg};border:1px solid ${C.border};border-radius:10px;">
            <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:${C.muted};margin-bottom:6px;">Shipping to</div>
            <div style="font-size:14px;line-height:1.5;color:${C.body};">${shipTo}</div>
          </div>

          <!-- What happens next -->
          <div style="margin-top:16px;padding:16px;background:${C.pageBg};border:1px solid ${C.border};border-radius:10px;">
            <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:${C.muted};margin-bottom:10px;">What happens next</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${nextSteps}</table>
          </div>

          <!-- CTA -->
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:24px;"><tr>
            <td style="border-radius:999px;background:${C.ink};">
              <a href="${esc(homeUrl)}" style="display:inline-block;padding:12px 24px;font-family:${FONT};font-size:14px;font-weight:600;color:${C.pageBg};text-decoration:none;border-radius:999px;">Continue shopping</a>
            </td>
          </tr></table>

        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 4px 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.muted};">
          You're receiving this because an order was placed at
          <a href="${esc(homeUrl)}" style="color:${C.muted};">${esc(storeDomain(store.subdomain))}</a>.
        </td></tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

/* ============================================================
   Plain-text body (fallback)
   ============================================================ */

function renderText(ctx: Omit<Ctx, "preheader">): string {
  const { store, order, currency, orderLabel, firstName, homeUrl } = ctx;

  const items = order.lineItems
    .map((li) => {
      const name = li.title + (li.variant ? ` · ${li.variant}` : "");
      return `  - ${name} × ${li.quantity}  ${money(li.price * li.quantity, currency)}`;
    })
    .join("\n");

  const steps = NEXT_STEPS.map((t, i) => `  ${i + 1}. ${t}`).join("\n");

  return [
    `${store.name}`,
    ``,
    `Order placed`,
    ``,
    `Thanks, ${firstName}. Your order ${orderLabel} is confirmed.`,
    `We'll email you shortly to arrange delivery and payment.`,
    ``,
    `Items`,
    items,
    ``,
    `  Subtotal  ${money(order.subtotal, currency)}`,
    `  Total     ${money(order.total, currency)}`,
    ``,
    `Shipping to`,
    `  ${order.shippingAddress.name}`,
    `  ${order.shippingAddress.address}`,
    ``,
    `What happens next`,
    steps,
    ``,
    `Continue shopping: ${homeUrl}`,
    ``,
    `You're receiving this because an order was placed at ${storeDomain(store.subdomain)}.`,
  ].join("\n");
}

/* ============================================================
   Helpers
   ============================================================ */

/** Escape HTML-significant characters so store/customer text can't break the markup. */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
