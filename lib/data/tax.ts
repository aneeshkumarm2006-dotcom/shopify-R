import type { TaxSettings } from "@/types";

/**
 * Tax engine (Phase 2). Pure, side-effect-free math so it's unit-testable and runs
 * identically server-side at checkout and client-side for the live order summary.
 *
 * A store with no tax config (or `enabled: false`) charges ZERO tax — so totals stay
 * exactly `subtotal − discount` for stores that never set it up. When enabled, the
 * default `rate` applies unless a `regionRates` entry overrides it for the shipping
 * region (matched case-insensitively, e.g. a US state code).
 */

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const norm = (s: string | undefined) => (s ?? "").trim().toUpperCase();

/** The effective tax rate (percent) for a region, or 0 when tax is off. */
export function taxRateFor(settings: TaxSettings | undefined, region?: string): number {
  if (!settings?.enabled) return 0;
  // A blank override region must NOT match a shopper with no region (both norm to "") —
  // that would silently apply a mis-entered override as the default rate.
  const override = settings.regionRates?.find(
    (r) => norm(r.region) !== "" && norm(r.region) === norm(region),
  );
  const rate = override?.rate ?? settings.rate ?? 0;
  return Math.max(0, rate);
}

/** Display label for the tax line, falling back to "Tax". */
export function taxLabel(settings: TaxSettings | undefined): string {
  return settings?.label?.trim() || "Tax";
}

/**
 * Tax owed on an order. `subtotal` is the post-discount goods total; `shipping` is
 * included in the taxable base only when `settings.appliesToShipping` is set.
 * Rounded to cents.
 */
export function computeTax(
  settings: TaxSettings | undefined,
  ctx: { subtotal: number; shipping?: number; region?: string },
): number {
  const rate = taxRateFor(settings, ctx.region);
  if (rate <= 0) return 0;
  const base =
    Math.max(0, ctx.subtotal) +
    (settings?.appliesToShipping ? Math.max(0, ctx.shipping ?? 0) : 0);
  return round2((base * rate) / 100);
}
