import type { Id, Timestamps } from "./common";

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

/** Canonical event types (stored as plain strings; this list powers filter UIs). */
export const EVENT_TYPES = [
  "auth.login",
  "account.first_provision",
  "store.created",
  "store.published",
  "store.unpublished",
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
] as const;
export type EventType = (typeof EVENT_TYPES)[number];
