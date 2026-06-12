import type {
  FulfillmentStatus,
  PaymentStatus,
  Product,
  ProductStatus,
  StoreStatus,
} from "@/types";
import type { PillTone } from "@/components/ui";
import { FULFILLMENT_TONE, PAYMENT_TONE, STATUS_TONE } from "@/components/ui";
import { money } from "@/lib/format";

/**
 * Admin-screen mapping helpers — domain status → pill {tone,label}, plus product
 * inventory aggregation. Kept in one place so every index/detail screen labels a
 * status identically. Pill tones come from the literal maps in `ui/badge` (lime is
 * never a status color — DESIGN §3.5).
 */

/**
 * The single demo tenant. As of Stage 7 the **admin** resolves its store from the
 * signed-in session (`requireMerchantStoreId()`), so this constant now only backs
 * the storefront `(store)` group + kitchen sink until Stage 8 wires subdomain →
 * storeId resolution there.
 */
export { MOCK_STORE_ID as CURRENT_STORE_ID } from "@/lib/data/mocks";

export const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  pending: "Pending",
  paid: "Paid",
  refunded: "Refunded",
};

export const FULFILLMENT_LABEL: Record<FulfillmentStatus, string> = {
  unfulfilled: "Unfulfilled",
  partially_fulfilled: "Partially fulfilled",
  fulfilled: "Fulfilled",
  cancelled: "Cancelled",
};

export const PRODUCT_STATUS_LABEL: Record<ProductStatus, string> = {
  active: "Active",
  draft: "Draft",
};

export const STORE_STATUS_LABEL: Record<StoreStatus, string> = {
  draft: "Draft",
  live: "Live",
  suspended: "Suspended",
};

export function paymentPill(s: PaymentStatus): { tone: PillTone; label: string } {
  return { tone: PAYMENT_TONE[s]!, label: PAYMENT_LABEL[s] };
}
export function fulfillmentPill(s: FulfillmentStatus): { tone: PillTone; label: string } {
  return { tone: FULFILLMENT_TONE[s]!, label: FULFILLMENT_LABEL[s] };
}
export function productStatusPill(s: ProductStatus): { tone: PillTone; label: string } {
  return { tone: STATUS_TONE[s]!, label: PRODUCT_STATUS_LABEL[s] };
}
export function storeStatusPill(s: StoreStatus): { tone: PillTone; label: string } {
  return { tone: STATUS_TONE[s]!, label: STORE_STATUS_LABEL[s] };
}

/* ---- Inventory aggregation (product index + dashboard) ---- */

export type StockStatus = "in_stock" | "low" | "out";

export const STOCK_TONE: Record<StockStatus, PillTone> = {
  in_stock: "success",
  low: "warning",
  out: "critical",
};
export const STOCK_LABEL: Record<StockStatus, string> = {
  in_stock: "In stock",
  low: "Low stock",
  out: "Out of stock",
};

/** Roll a product's variants up to one on-hand total + a worst-case stock status. */
export function productInventory(p: Product): { total: number; status: StockStatus } {
  const total = p.variants.reduce((s, v) => s + v.inventory.quantity, 0);
  const anyOut = p.variants.some((v) => v.inventory.quantity <= 0);
  const anyLow = p.variants.some(
    (v) =>
      v.inventory.quantity > 0 && v.inventory.quantity <= v.inventory.lowStockThreshold,
  );
  const status: StockStatus = total <= 0 ? "out" : anyLow || anyOut ? "low" : "in_stock";
  return { total, status };
}

/** Single price, or a `$min – $max` range across variants. */
export function priceRange(p: Product, currency = "$"): string {
  const prices = p.variants.map((v) => v.price);
  if (prices.length === 0) return money(0, currency);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max
    ? money(min, currency)
    : `${money(min, currency)} – ${money(max, currency)}`;
}
