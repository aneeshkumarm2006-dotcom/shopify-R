import type { DashboardStats, Order } from "@/types";
import { mockDashboardStats } from "./mocks";
import { resolve } from "./_util";
import { isDbConfigured, Orders, Customers } from "@/lib/db";

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
