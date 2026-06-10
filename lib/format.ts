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

/** `$1,234.00` — two-decimal money with a leading currency symbol. */
export function money(amount: number, currency = "$"): string {
  return (
    currency +
    amount.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
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
