/**
 * Display formatters shared across admin + storefront screens.
 *
 * All formatters pin the `en-US` locale so server and client render identically
 * (no hydration drift). Currency is a display symbol only — there is no FX in MVP
 * (PRD §6.1 / store.settings.currency).
 */

/** App apex domain — reads NEXT_PUBLIC_APP_DOMAIN so dev and prod stay consistent. */
export const APP_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN || "ourapp.com";

/**
 * Stores are namespaced by PATH, not subdomain: `<app>/s/<subdomain>`. This works on a
 * single host (e.g. a `*.vercel.app` deployment) where wildcard subdomains aren't
 * available. `middleware.ts` rewrites `/s/<subdomain>/...` to the internal `(store)`
 * routes and stamps the resolved tenant for `resolveStorefront()`.
 */
export function storePath(subdomain: string): string {
  return `/s/${subdomain}`;
}

/**
 * A store's public address for DISPLAY, e.g. `myshop.vercel.app/s/northbound`. Uses
 * `APP_DOMAIN` (not `window`) so server and client render identically (no hydration
 * drift) — set `NEXT_PUBLIC_APP_DOMAIN` to your deployment host for an accurate label.
 */
export function storeDomain(subdomain: string): string {
  return `${APP_DOMAIN}${storePath(subdomain)}`;
}

/**
 * Absolute URL to a store's public site — what "View store" opens. In the browser it
 * uses the current origin (so it's correct on any deployment host); on the server it
 * falls back to `APP_DOMAIN` over https.
 */
export function storeOrigin(subdomain: string): string {
  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : `https://${APP_DOMAIN}`;
  return `${origin}${storePath(subdomain)}`;
}

/**
 * Supported presentment currencies (Phase 2). Display only — there is no FX; a store
 * picks ONE currency. The symbol is used for compact UI; the ISO code drives
 * `Intl.NumberFormat` for correct symbol placement and decimals.
 */
export const CURRENCIES: { code: string; symbol: string; label: string }[] = [
  { code: "USD", symbol: "$", label: "US Dollar" },
  { code: "EUR", symbol: "€", label: "Euro" },
  { code: "GBP", symbol: "£", label: "British Pound" },
  { code: "CAD", symbol: "$", label: "Canadian Dollar" },
  { code: "AUD", symbol: "$", label: "Australian Dollar" },
  { code: "INR", symbol: "₹", label: "Indian Rupee" },
  { code: "JPY", symbol: "¥", label: "Japanese Yen" },
];

const ISO_CODE = /^[A-Z]{3}$/;

/**
 * `$1,234.00` — two-decimal money. `currency` may be either a bare display symbol
 * (e.g. "$", the back-compat path) OR an ISO-4217 code (e.g. "USD", "EUR"). When an
 * ISO code is given, `Intl.NumberFormat` renders the correct symbol + placement +
 * decimals (e.g. JPY shows no decimals); the `en-US` locale is pinned so server and
 * client agree (no hydration drift).
 */
export function money(amount: number, currency = "$"): string {
  if (ISO_CODE.test(currency)) {
    try {
      return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
    } catch {
      /* unknown code → fall through to symbol-prefix formatting */
    }
  }
  return (
    currency +
    amount.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

/**
 * The token to pass to `money()` for a store: the ISO `currencyCode` when set
 * (multi-currency), otherwise the legacy `currency` symbol, otherwise "$".
 */
export function storeCurrency(settings?: { currency?: string; currencyCode?: string }): string {
  return settings?.currencyCode?.trim() || settings?.currency?.trim() || "$";
}

/** `Jun 6, 2026` */
export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** `Jun 6, 2026 · 2:22 PM` — used for age-verification + event timestamps. */
export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${date} · ${time}`;
}
