import type { DashboardStats, Order } from "@/types";
import { mockDashboardStats } from "./mocks";
import { resolve } from "./_util";
import { isDbConfigured, dbConnect, Orders, Customers, PageViewModel, CartModel } from "@/lib/db";
import {
  funnelRates,
  buildReferrerBreakdown,
  buildCohorts,
  topProductsFromOrders,
  type FunnelRates,
  type ReferrerRow,
  type CohortRow,
  type TopProductRow,
} from "./analytics-insights";

const DAY_MS = 24 * 60 * 60 * 1000;

function pctDelta(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/** Minimal dashboard analytics (PRD §6.9) — totals + period deltas. */
export async function getDashboardStats(
  storeId: string,
  period: "7d" | "30d" = "30d",
): Promise<DashboardStats> {
  if (!isDbConfigured()) {
    void storeId;
    void period;
    return resolve(mockDashboardStats);
  }

  const days = period === "7d" ? 7 : 30;
  const now = Date.now();
  const currentStart = new Date(now - days * DAY_MS);
  const previousStart = new Date(now - 2 * days * DAY_MS);

  // Pull the trailing two periods once, then split in memory for the delta.
  const [orders, customers] = await Promise.all([
    Orders.findMany(storeId, { createdAt: { $gte: previousStart } }),
    Customers.findMany(storeId, { createdAt: { $gte: previousStart } }),
  ]);

  const inCurrent = (iso: string) => new Date(iso).getTime() >= currentStart.getTime();
  const salesOf = (rows: Order[]) => rows.reduce((sum, o) => sum + (o.total || 0), 0);

  const curOrders = orders.filter((o) => inCurrent(o.createdAt));
  const prevOrders = orders.filter((o) => !inCurrent(o.createdAt));
  const curCustomers = customers.filter((c) => inCurrent(c.createdAt));
  const prevCustomers = customers.filter((c) => !inCurrent(c.createdAt));

  return {
    sales: salesOf(curOrders),
    orders: curOrders.length,
    customers: curCustomers.length,
    salesDelta: pctDelta(salesOf(curOrders), salesOf(prevOrders)),
    ordersDelta: pctDelta(curOrders.length, prevOrders.length),
    customersDelta: pctDelta(curCustomers.length, prevCustomers.length),
  };
}

/* ============================================================
   Deeper analytics (Phase 6) — funnel · attribution · cohorts · top products.
   ============================================================ */

export interface DailySalesPoint {
  date: string; // YYYY-MM-DD
  sales: number;
  orders: number;
}

export interface StoreAnalytics {
  period: "7d" | "30d";
  funnel: { visitors: number; carts: number; orders: number; rates: FunnelRates };
  referrers: ReferrerRow[];
  cohorts: CohortRow[];
  topProducts: TopProductRow[];
  daily: DailySalesPoint[];
  revenue: number;
}

const EMPTY_ANALYTICS = (period: "7d" | "30d"): StoreAnalytics => ({
  period,
  funnel: { visitors: 0, carts: 0, orders: 0, rates: funnelRates(0, 0, 0) },
  referrers: [],
  cohorts: [],
  topProducts: [],
  daily: [],
  revenue: 0,
});

/** Build a continuous daily sales series across the window (zero-filled). */
function dailySeries(orders: Order[], startMs: number, days: number): DailySalesPoint[] {
  const buckets = new Map<string, { sales: number; orders: number }>();
  for (let i = 0; i < days; i++) {
    const day = new Date(startMs + i * DAY_MS).toISOString().slice(0, 10);
    buckets.set(day, { sales: 0, orders: 0 });
  }
  for (const o of orders) {
    const day = o.createdAt.slice(0, 10);
    const b = buckets.get(day);
    if (b) {
      b.sales += o.total || 0;
      b.orders += 1;
    }
  }
  return [...buckets.entries()].map(([date, b]) => ({ date, ...b }));
}

/**
 * Full analytics report for the store over a window. Funnel + traffic come from
 * pageviews/carts (period-scoped); cohorts span all customers (lifetime join months).
 * Everything routes through tenant-scoped reads. Returns zeros without a DB.
 */
export async function getStoreAnalytics(
  storeId: string,
  period: "7d" | "30d" = "30d",
): Promise<StoreAnalytics> {
  if (!isDbConfigured()) return EMPTY_ANALYTICS(period);

  const days = period === "7d" ? 7 : 30;
  const startMs = Date.now() - days * DAY_MS;
  const start = new Date(startMs);

  await dbConnect();
  const [pageviews, cartCount, orders, allCustomers] = await Promise.all([
    PageViewModel.find({ storeId, createdAt: { $gte: start } })
      .select("sessionId ref")
      .lean<{ sessionId: string | null; ref: string | null }[]>(),
    CartModel.countDocuments({ storeId, createdAt: { $gte: start } }),
    Orders.findMany(storeId, { createdAt: { $gte: start } }),
    Customers.findMany(storeId), // lifetime, for join cohorts
  ]);

  const visitors = new Set(pageviews.map((p) => p.sessionId ?? Math.random().toString())).size;
  const orderCount = orders.length;

  return {
    period,
    funnel: {
      visitors,
      carts: cartCount,
      orders: orderCount,
      rates: funnelRates(visitors, cartCount, orderCount),
    },
    referrers: buildReferrerBreakdown(pageviews.map((p) => p.ref)),
    cohorts: buildCohorts(allCustomers),
    topProducts: topProductsFromOrders(orders),
    daily: dailySeries(orders, startMs, days),
    revenue: orders.reduce((s, o) => s + (o.total || 0), 0),
  };
}
