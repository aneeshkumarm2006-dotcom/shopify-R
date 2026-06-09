import type { Product, Variant } from "@/types";

/**
 * Storefront ("Counter" theme) shared helpers — small, presentational utilities
 * used across the section components and composite page views (DESIGN §5).
 *
 * Stage 8 serves each store on its own subdomain: `middleware.ts` rewrites a live
 * store's `/` into the `(store)` group's internal `/preview` home, so the customer's
 * home URL is a clean `/`. `STORE_HOME` is that public home path; storefront links use
 * it. (To exercise the storefront in dev, visit `<store>.localhost:3000`; a bare
 * `localhost:3000/` is the marketing apex, with the demo home still at `/preview`.)
 */
export const STORE_HOME = "/";

/** Per-variant stock state, mirroring the admin inventory roll-up (DESIGN §5.4). */
export type StockState = "in_stock" | "low" | "out";

/**
 * Resolve a variant's stock state, honoring its out-of-stock policy:
 *  - `continue` (oversell) is never "out" — it always sells.
 *  - `deny` is "out" at/below zero, "low" within the threshold, else "in_stock".
 * Untracked inventory always reads as in-stock.
 */
export function variantStock(v: Variant): StockState {
  const { quantity, policy, lowStockThreshold, trackInventory } = v.inventory;
  if (!trackInventory) return "in_stock";
  if (quantity <= 0) return policy === "continue" ? "in_stock" : "out";
  if (quantity <= lowStockThreshold) return "low";
  return "in_stock";
}

/** Whether a variant can be added to cart (deny policy blocks at zero). */
export function variantAvailable(v: Variant): boolean {
  return variantStock(v) !== "out";
}

/** True when any sellable variant exists — drives the product-card "Sold out" badge. */
export function productInStock(p: Product): boolean {
  return p.variants.some(variantAvailable);
}

/** The variant a card/quick-add should default to: first sellable, else the first. */
export function defaultVariant(p: Product): Variant | undefined {
  return p.variants.find(variantAvailable) ?? p.variants[0];
}

/** Lowest variant price — the "from" price shown on cards. */
export function fromPrice(p: Product): number {
  return p.variants.reduce((min, v) => Math.min(min, v.price), p.variants[0]?.price ?? 0);
}

/** First variant carrying a compare-at price (drives the "Sale" badge on cards). */
export function saleVariant(p: Product): Variant | undefined {
  return p.variants.find((v) => v.compareAtPrice != null && v.compareAtPrice > v.price);
}

/** Stable cart-line key: one line per (product, variant). */
export function lineKey(productId: string, variantId: string): string {
  return `${productId}:${variantId}`;
}

/** A short, human "type" label for a product, inferred from its first option. */
export function productType(p: Product): string {
  return p.options[0]?.name ?? "Product";
}
