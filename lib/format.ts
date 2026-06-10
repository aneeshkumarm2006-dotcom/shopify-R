/**
 * Display formatters shared across admin + storefront screens.
 *
 * All formatters pin the `en-US` locale so server and client render identically
 * (no hydration drift). Currency is a display symbol only — there is no FX in MVP
 * (PRD §6.1 / store.settings.currency).
 */

/** App apex domain — reads NEXT_PUBLIC_APP_DOMAIN so dev (localhost) and prod are consistent. */
export const APP_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN || "offshelf.app";

/** A store's public address, e.g. `northbound.ourapp.com`. */
export function storeDomain(subdomain: string): string {
  return `${subdomain}.${APP_DOMAIN}`;
}

/** Full origin for a store's public site, using http for localhost and https otherwise. */
export function storeOrigin(subdomain: string): string {
  const domain = storeDomain(subdomain);
  const proto = domain.includes("localhost") ? "http" : "https";
  return `${proto}://${domain}`;
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
