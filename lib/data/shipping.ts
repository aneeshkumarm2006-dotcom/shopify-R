import type { ShippingRate, ShippingSettings } from "@/types";

/**
 * Shipping engine (Phase 2). Pure, side-effect-free so the storefront can list rates
 * client-side while `placeOrder` resolves the authoritative price server-side (the
 * client only ever sends a rate id — never a price, mirroring the discount anti-tamper
 * discipline).
 *
 * A store with no shipping config (or `enabled: false`, or zero rates) falls back to a
 * single free "Standard" rate, so totals stay `subtotal − discount + tax` for stores
 * that never set shipping up. `freeOver` zeroes a rate once the discounted subtotal
 * reaches it; `regions` (when non-empty) limits a rate to matching regions/states.
 */

/** A rate with its effective (region/threshold-resolved) price — what checkout uses. */
export interface ResolvedShippingRate {
  id: string;
  label: string;
  price: number;
}

const norm = (s: string | undefined) => (s ?? "").trim().toUpperCase();

/** The always-available fallback when a store hasn't configured shipping. */
const DEFAULT_RATE: ResolvedShippingRate = { id: "standard", label: "Standard", price: 0 };

/** Does this rate apply to the given shipping region? (No `regions` ⇒ everywhere.) */
function appliesToRegion(rate: ShippingRate, region?: string): boolean {
  if (!rate.regions || rate.regions.length === 0) return true;
  return rate.regions.map(norm).includes(norm(region));
}

/** A rate's effective price: free once `freeOver` is met, otherwise its flat price. */
function effectivePrice(rate: ShippingRate, subtotal: number): number {
  if (rate.freeOver != null && subtotal >= rate.freeOver) return 0;
  return Math.max(0, rate.price);
}

/**
 * The shipping rates a customer can choose, with effective prices for this cart.
 * Always returns at least one option (the free "Standard" fallback) so checkout can
 * always render a selectable rate.
 */
export function availableShippingRates(
  settings: ShippingSettings | undefined,
  ctx: { subtotal: number; region?: string },
): ResolvedShippingRate[] {
  if (!settings?.enabled || !settings.rates?.length) return [DEFAULT_RATE];
  const resolved = settings.rates
    .filter((r) => appliesToRegion(r, ctx.region))
    .map((r) => ({ id: r.id, label: r.label, price: effectivePrice(r, ctx.subtotal) }));
  return resolved.length > 0 ? resolved : [DEFAULT_RATE];
}

/**
 * Resolve the authoritative shipping rate for an order. Picks the requested `rateId`
 * when it's actually available for this cart/region; otherwise falls back to the first
 * available rate (never trusts a client-sent price).
 */
export function resolveShippingRate(
  settings: ShippingSettings | undefined,
  ctx: { subtotal: number; region?: string; rateId?: string },
): ResolvedShippingRate {
  const available = availableShippingRates(settings, ctx);
  const chosen = ctx.rateId ? available.find((r) => r.id === ctx.rateId) : undefined;
  return chosen ?? available[0] ?? DEFAULT_RATE;
}
