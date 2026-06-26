import type { Customer, Order } from "@/types";

/**
 * Deeper analytics (Phase 6) — pure aggregation helpers so the funnel, attribution,
 * and cohort math is unit-testable and reused by the analytics page. The data layer
 * (`getStoreAnalytics`) pulls the rows; these turn them into the reported shapes.
 */

/* ------------------------------------------------------------- funnel ---- */

export interface FunnelRates {
  viewToCart: number; // %
  cartToOrder: number; // %
  viewToOrder: number; // %
}

const pct = (num: number, den: number) => (den <= 0 ? 0 : Math.round((num / den) * 1000) / 10);

/** Conversion rates across the views → carts → orders funnel. */
export function funnelRates(views: number, carts: number, orders: number): FunnelRates {
  return {
    viewToCart: pct(carts, views),
    cartToOrder: pct(orders, carts),
    viewToOrder: pct(orders, views),
  };
}

/* -------------------------------------------------------- attribution ---- */

export interface ReferrerRow {
  source: string;
  count: number;
  pct: number;
}

/** Normalize a referrer to a host (or "Direct" for none/own-site). */
export function referrerSource(ref: string | null | undefined): string {
  const raw = (ref ?? "").trim();
  if (!raw) return "Direct";
  try {
    const host = new URL(raw).hostname.replace(/^www\./, "");
    return host || "Direct";
  } catch {
    return raw.replace(/^www\./, "").split("/")[0] || "Direct";
  }
}

/** Top traffic sources by referrer, descending, with share-of-total. */
export function buildReferrerBreakdown(refs: (string | null | undefined)[], limit = 8): ReferrerRow[] {
  const counts = new Map<string, number>();
  for (const ref of refs) {
    const source = referrerSource(ref);
    counts.set(source, (counts.get(source) ?? 0) + 1);
  }
  const total = refs.length;
  return [...counts.entries()]
    .map(([source, count]) => ({ source, count, pct: pct(count, total) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/* ------------------------------------------------------------ cohorts ---- */

export interface CohortRow {
  month: string; // "YYYY-MM"
  count: number; // customers who joined that month
  repeat: number; // of those, how many have ordered more than once
  repeatRate: number; // %
}

const monthKey = (iso: string) => iso.slice(0, 7);

/** Monthly join cohorts with repeat-purchase rate (orderCount > 1), newest first. */
export function buildCohorts(customers: Pick<Customer, "createdAt" | "orderCount">[]): CohortRow[] {
  const byMonth = new Map<string, { count: number; repeat: number }>();
  for (const c of customers) {
    const key = monthKey(c.createdAt);
    const bucket = byMonth.get(key) ?? { count: 0, repeat: 0 };
    bucket.count++;
    if (c.orderCount > 1) bucket.repeat++;
    byMonth.set(key, bucket);
  }
  return [...byMonth.entries()]
    .map(([month, b]) => ({ month, count: b.count, repeat: b.repeat, repeatRate: pct(b.repeat, b.count) }))
    .sort((a, b) => (a.month < b.month ? 1 : -1));
}

/* ------------------------------------------------------- top products ---- */

export interface TopProductRow {
  title: string;
  units: number;
  revenue: number;
}

/** Best-selling products by units from order line-item snapshots, descending. */
export function topProductsFromOrders(orders: Pick<Order, "lineItems">[], limit = 5): TopProductRow[] {
  const agg = new Map<string, { units: number; revenue: number }>();
  for (const order of orders) {
    for (const li of order.lineItems) {
      const row = agg.get(li.title) ?? { units: 0, revenue: 0 };
      row.units += li.quantity;
      row.revenue += li.price * li.quantity;
      agg.set(li.title, row);
    }
  }
  return [...agg.entries()]
    .map(([title, v]) => ({ title, units: v.units, revenue: v.revenue }))
    .sort((a, b) => b.units - a.units)
    .slice(0, limit);
}
