import type { Id, ISODate, Timestamps } from "./common";
import type { FulfillmentStatus, PaymentStatus, SettlementMethod } from "./commerce";
import type { SubscriptionPlan } from "./store";

/* ============================================================
   Platform operator observability — append-only activity/audit log
   ============================================================ */

export type ActorType = "merchant" | "platform_admin" | "system";

/** What an event acted on (a product, order, store, …) — for the activity feed. */
export interface EventTarget {
  kind: string; // "product" | "order" | "store" | "discount" | ...
  id?: string;
  label?: string;
}

/**
 * One recorded merchant/operator action. Append-only, cross-tenant (the operator
 * reads across stores) but every write is stamped with the `storeId`/`actorUserId`
 * it belongs to. Deliberately metadata-only — NO end-shopper PII (no buyer names,
 * emails, addresses, or order contents); order events carry id + status + amount.
 */
export interface PlatformEvent extends Timestamps {
  _id: Id;
  actorUserId?: string | null; // the merchant/operator who acted (null for system)
  actorType: ActorType;
  storeId?: string | null; // the tenant affected (null for account-level events)
  type: string; // see EVENT_TYPES
  target?: EventTarget | null;
  metadata?: Record<string, unknown>; // small, PII-free context (e.g. { from, to })
  ip?: string | null;
  ua?: string | null;
}

/* ============================================================
   Platform error / incident tracking (operator "what broke" log)
   ============================================================ */
export type ErrorSeverity = "info" | "warning" | "error" | "critical";

export interface PlatformError extends Timestamps {
  _id: Id;
  /** Where it happened: "checkout" | "payment.webhook" | "action:publish" | … */
  source: string;
  message: string;
  stack?: string | null;
  severity: ErrorSeverity;
  storeId?: string | null;
  actorUserId?: string | null;
  metadata?: Record<string, unknown>;
  resolved: boolean;
  resolvedAt?: import("./common").ISODate | null;
}

/** The operator "needs attention" triage rollup. */
export interface NeedsAttention {
  openErrors: number;
  criticalErrors: number;
  misalignedStores: number;
  /** COD/in-store orders left unpaid for too long. */
  stuckOrders: number;
  suspendedStores: number;
}

/* ============================================================
   Commerce monitoring + support tooling (operator P2)
   ============================================================ */

/** A cross-tenant order row for the global orders stream. */
export interface PlatformOrderRow {
  id: string;
  orderNumber: number;
  storeId: string;
  storeName: string;
  total: number;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  settlementMethod: SettlementMethod;
  createdAt: ISODate;
  /** Unpaid COD/in-store order older than the stuck threshold. */
  stuck: boolean;
}

/** Platform revenue snapshot (plan-based; no real processor). */
export interface RevenueMetrics {
  /** Monthly recurring revenue from active paid plans (plan price × count). */
  mrr: number;
  payingAccounts: number;
  freeAccounts: number;
  standardAccounts: number;
}

/** One global-search hit (store / user / order / product). */
export interface PlatformSearchHit {
  kind: "store" | "user" | "order" | "product";
  id: string;
  label: string;
  sub?: string;
  href: string;
}

/* ---- System health + email log (operator P3) ---- */
export interface ServiceStatus {
  configured: boolean;
  connected?: boolean;
  latencyMs?: number | null;
}

export interface SystemHealth {
  db: ServiceStatus;
  email: ServiceStatus;
  payments: ServiceStatus; // storefront processor
  billing: ServiceStatus; // platform billing
  auth: ServiceStatus;
}

export type EmailStatus = "sent" | "failed";

export interface EmailLogEntry extends Timestamps {
  _id: Id;
  to: string;
  subject: string;
  kind: string; // "order_confirmation" | …
  storeId?: string | null;
  status: EmailStatus;
  error?: string | null;
}

/* ---- Storefront visitor analytics (operator P4) ---- */
export interface TrafficPoint {
  date: string; // YYYY-MM-DD
  views: number;
}

export interface StoreTraffic {
  views: number;
  sessions: number;
  byDay: TrafficPoint[];
  topPaths: { path: string; views: number }[];
}

export interface PlatformTrafficStore {
  storeId: string;
  storeName: string;
  views: number;
  sessions: number;
}

export interface PlatformTraffic {
  totalViews: number;
  totalSessions: number;
  byDay: TrafficPoint[];
  topStores: PlatformTrafficStore[];
}

/** Internal operator note pinned to a store (support trail). */
export interface StoreNote extends Timestamps {
  _id: Id;
  storeId: string;
  authorId?: string | null;
  authorEmail?: string | null;
  body: string;
}

/** Canonical event types (stored as plain strings; this list powers filter UIs). */
export const EVENT_TYPES = [
  "auth.login",
  "account.first_provision",
  "store.created",
  "store.published",
  "store.unpublished",
  "store.deleted",
  "store.suspended",
  "store.reinstated",
  "subdomain.claimed",
  "plan.changed",
  "product.created",
  "product.updated",
  "product.deleted",
  "product.status_changed",
  "collection.created",
  "collection.updated",
  "collection.deleted",
  "page.created",
  "page.updated",
  "page.deleted",
  "inventory.adjusted",
  "discount.created",
  "discount.updated",
  "discount.deleted",
  "order.status_changed",
  "order.fulfilled",
  "settings.updated",
  "settings.code_injection_changed",
  "impersonation.started",
  "impersonation.ended",
  "domain.added",
  "domain.verified",
  "domain.failed",
  "domain.removed",
  "domain.set_primary",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];
