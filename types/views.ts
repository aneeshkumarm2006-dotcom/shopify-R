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
  name: string;
  owner: string; // owner email
  subdomain: string;
  status: StoreStatus;
  plan: SubscriptionPlan;
  createdAt: ISODate;
}
