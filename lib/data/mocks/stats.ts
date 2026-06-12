import type { DashboardStats, PlatformStoreSummary } from "@/types";

/** Dashboard analytics (PRD §6.9) — 30-day snapshot for the demo store. */
export const mockDashboardStats: DashboardStats = {
  sales: 4210,
  orders: 38,
  customers: 21,
  salesDelta: 12.4,
  ordersDelta: 8.0,
  customersDelta: -2.1,
};

/** Platform admin store list (PRD §4.12) — internal, cross-tenant. */
export const mockPlatformStores: PlatformStoreSummary[] = [
  { id: "store_northbound", name: "Northbound", owner: "hello@northbound.co", subdomain: "northbound", status: "live", plan: "standard", createdAt: "2026-03-02T00:00:00.000Z" },
  { id: "store_emberash", name: "Ember & Ash", owner: "team@emberash.co", subdomain: "emberash", status: "live", plan: "standard", createdAt: "2026-04-18T00:00:00.000Z" },
  { id: "store_highland", name: "Highland Botanicals", owner: "ops@highlandbot.co", subdomain: "highland", status: "draft", plan: "free", createdAt: "2026-05-30T00:00:00.000Z" },
  { id: "store_cinder", name: "Cinder Vapor", owner: "me@cindervapor.co", subdomain: "cinder", status: "suspended", plan: "standard", createdAt: "2026-02-11T00:00:00.000Z" },
  { id: "store_verdant", name: "Verdant Leaf", owner: "hi@verdantleaf.co", subdomain: "verdant", status: "live", plan: "free", createdAt: "2026-06-01T00:00:00.000Z" },
];
