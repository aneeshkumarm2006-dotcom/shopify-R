import type { Cart, Store } from "@/types";
import type { RenderedEmail } from "./templates";
import { money, storeDomain } from "@/lib/format";

/**
 * Marketing / lifecycle email templates (Phase 5) — abandoned-cart recovery and
 * generic campaign broadcasts. Pure renderers (no I/O) so they're unit-testable.
 * Like the transactional template, these use literal hex + inline styles (email
 * clients don't support CSS variables); the palette mirrors styles/tokens.css.
 */

const C = {
  pageBg: "#faf9f5",
  surface: "#ffffff",
  border: "#e3e0d6",
  ink: "#16140e",
  body: "#2c2920",
  muted: "#857f6c",
  accent: "#97c518",
} as const;
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "ui-monospace,'SF Mono',Menlo,Consolas,'Liberation Mono',monospace";

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Shared outer shell: store name header, white card with `inner`, muted footer. */
function shell(storeName: string, homeUrl: string, footer: string, inner: string, preheader = ""): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${C.pageBg};">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;">${esc(preheader)}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.pageBg};"><tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;font-family:${FONT};">
    <tr><td style="padding:0 4px 20px;font-size:18px;font-weight:700;letter-spacing:-0.01em;color:${C.ink};">${esc(storeName)}</td></tr>
    <tr><td style="background:${C.surface};border:1px solid ${C.border};border-radius:14px;padding:32px;">${inner}</td></tr>
    <tr><td style="padding:20px 4px 0;font-size:12px;line-height:1.6;color:${C.muted};">${esc(footer)} <a href="${esc(homeUrl)}" style="color:${C.muted};">${esc(storeDomain(homeUrl.replace(/^https?:\/\//, "")))}</a></td></tr>
  </table>
</td></tr></table></body></html>`;
}

function button(label: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:24px;"><tr><td style="border-radius:999px;background:${C.ink};">
    <a href="${esc(url)}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:${C.pageBg};text-decoration:none;border-radius:999px;">${esc(label)}</a>
  </td></tr></table>`;
}

/* ------------------------------------------------- abandoned cart ---- */

export interface AbandonedCartData {
  store: Pick<Store, "name" | "subdomain" | "settings">;
  cart: Pick<Cart, "items">;
  /** Per-item display info resolved from the catalog by the caller. */
  lines: { title: string; quantity: number; price: number }[];
  recoverUrl: string;
}

export function renderAbandonedCartEmail(data: AbandonedCartData): RenderedEmail {
  const { store, lines, recoverUrl } = data;
  const currency = store.settings.currency || "$";
  const homeUrl = `https://${storeDomain(store.subdomain)}`;
  const total = lines.reduce((s, l) => s + l.price * l.quantity, 0);

  const itemRows = lines
    .map(
      (l) => `<tr>
        <td style="padding:10px 0;border-bottom:1px solid ${C.border};color:${C.body};font-size:14px;">${esc(l.title)} <span style="color:${C.muted};">× ${l.quantity}</span></td>
        <td align="right" style="padding:10px 0;border-bottom:1px solid ${C.border};color:${C.ink};font-family:${MONO};font-size:14px;white-space:nowrap;">${esc(money(l.price * l.quantity, currency))}</td>
      </tr>`,
    )
    .join("");

  const inner = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;letter-spacing:-0.01em;color:${C.ink};">You left something behind</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:${C.body};">Your cart is still saved at ${esc(store.name)}. Pick up right where you left off.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itemRows}
      <tr><td style="padding:14px 0 0;font-size:15px;font-weight:700;color:${C.ink};">Total</td>
      <td align="right" style="padding:14px 0 0;font-family:${MONO};font-size:15px;font-weight:700;color:${C.ink};">${esc(money(total, currency))}</td></tr>
    </table>
    ${button("Return to cart", recoverUrl)}`;

  return {
    subject: `You left ${lines.length} item${lines.length === 1 ? "" : "s"} in your cart`,
    html: shell(store.name, homeUrl, "You're receiving this because you started an order at", inner, "Your cart is still saved — complete your order anytime."),
    text: [
      `${store.name}`,
      ``,
      `You left something behind`,
      ``,
      `Your cart is still saved. Pick up where you left off:`,
      ...lines.map((l) => `  - ${l.title} × ${l.quantity}  ${money(l.price * l.quantity, currency)}`),
      ``,
      `  Total  ${money(total, currency)}`,
      ``,
      `Return to cart: ${recoverUrl}`,
    ].join("\n"),
  };
}

/* ----------------------------------------------------- campaign ---- */

export interface CampaignEmailData {
  store: Pick<Store, "name" | "subdomain">;
  subject: string;
  body: string; // plain text; blank lines become paragraphs
}

export function renderCampaignEmail(data: CampaignEmailData): RenderedEmail {
  const { store, subject, body } = data;
  const homeUrl = `https://${storeDomain(store.subdomain)}`;

  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${C.body};">${esc(p).replace(/\n/g, "<br>")}</p>`,
    )
    .join("");

  const inner = `
    ${subject ? `<h1 style="margin:0 0 16px;font-size:22px;font-weight:700;letter-spacing:-0.01em;color:${C.ink};">${esc(subject)}</h1>` : ""}
    ${paragraphs}
    ${button("Visit the store", homeUrl)}`;

  return {
    subject: subject || `News from ${store.name}`,
    html: shell(store.name, homeUrl, "You're receiving this because you're a customer of", inner),
    text: [store.name, "", subject, "", body, "", `Visit: ${homeUrl}`].filter((l) => l !== undefined).join("\n"),
  };
}
