import type { ISODate } from "./common";
import type { StoreStatus, SubscriptionPlan } from "./store";

/**
 * View / aggregate shapes that are NOT first-class PRD §5 collections but are
 * needed by Part A screens (dashboard analytics, platform admin). They derive
 * from the real collections; the stub layer returns them precomputed.
 */

/** Dashboard analytics (PRD §6.9) — totals + period deltas. */
export interface DashboardStats {
  sales: number;
  orders: number;
  customers: number;
  salesDelta: number; // % vs previous period
  ordersDelta: number;
  customersDelta: number;
}

/** Platform admin store row (PRD §6.10 / §4.12). */
export interface PlatformStoreSummary {
  id: string; // storeId — for linking to the operator store-detail view
  name: string;
  owner: string; // owner email
  subdomain: string;
  status: StoreStatus;
  plan: SubscriptionPlan;
  createdAt: ISODate;
  /** Count of failing health checks (operator "alignment" flag); 0 = healthy. */
  healthFlags?: number;
}

/* ============================================================
   Operator portal — health, store detail, KPIs, users
   ============================================================ */
export type HealthSeverity = "high" | "medium" | "low" | "info";

/** One alignment check result for a store (the "are they in a proper state?" engine). */
export interface HealthCheckResult {
  id: string;
  severity: HealthSeverity;
  ok: boolean;
  message: string;
}

/** Operator store-detail view — config snapshot + counts + health. */
export interface StoreOperatorDetail {
  store: import("./store").Store;
  ownerEmail: string;
  plan: SubscriptionPlan;
  productCount: number;
  orderCount: number;
  customerCount: number;
  health: HealthCheckResult[];
}

/** Platform KPIs for the operator overview. */
export interface PlatformKpis {
  totalStores: number;
  liveStores: number;
  draftStores: number;
  suspendedStores: number;
  freePlan: number;
  standardPlan: number;
  newStores7d: number;
  newStores30d: number;
  totalMerchants: number;
  totalOrders: number;
  /** GMV proxy — sum of `paid` order totals (no real billing pipeline). */
  gmvPaid: number;
}

/** Operator user/account row. */
export interface PlatformUserSummary {
  id: string;
  email: string;
  name: string;
  role: "merchant" | "platform_admin";
  storeCount: number;
  plan: SubscriptionPlan;
}
