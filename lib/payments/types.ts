import type { PaymentStatus, SubscriptionPlan } from "@/types";

/**
 * Payment & billing seam contracts (Stage 12, PRD §2.3 / §6.11).
 *
 * Offshelf serves high-risk verticals whose mainstream processors (Shopify
 * Payments / Stripe) refuse the category, so the MVP deliberately ships *no* live
 * processing. What it ships instead are the **typed integration points** a future
 * high-risk processor drops into — two independent streams:
 *
 *   1. **Storefront payments** — end customers paying a merchant for products.
 *      Orders are created `paymentStatus: pending`; a processor later mints a
 *      `PaymentIntent`, stamps `order.paymentIntent`, and drives status changes
 *      through a webhook (`PaymentWebhookEvent`).
 *   2. **Platform billing** — merchants paying *us* a subscription. Provisioned
 *      manually today (`subscription` doc, `billingSeam` reserved); a billing
 *      processor later fills `BillingSeam` and serves a `BillingPortalSession`.
 *
 * Nothing here imports a payment SDK. These are the *shapes* the rest of the app
 * already speaks (`order.paymentIntent`, `subscription.billingSeam`,
 * `subscription.plan`), so wiring a real processor is an implementation swap, not
 * a re-architecture.
 */

/* ============================================================
   Stream 1 — storefront payments (customer → merchant)
   ============================================================ */

/** Normalized intent reference. `id` is what we persist on `order.paymentIntent`. */
export interface PaymentIntent {
  /** Processor-side intent id (e.g. `pi_…`). Persisted on `order.paymentIntent`. */
  id: string;
  /** Which seam minted it — lets a webhook route by provider later. */
  provider: string;
  /** Order lifecycle status this intent currently maps to. */
  status: PaymentStatus;
  /** Opaque token a hosted/SDK card form would consume. Never a card number. */
  clientSecret?: string;
}

/** What checkout hands the seam to (optionally) open a payment intent. */
export interface CreatePaymentIntentInput {
  /** The freshly-created order this intent settles (absent for pre-order intents). */
  orderId?: string;
  /** Server-derived, minor-unit-agnostic amount (PRD: no tax/shipping engine). */
  amount: number;
  /** Display/settlement currency symbol or code carried from store settings. */
  currency: string;
  /** Customer email, for processor-side receipts/matching. */
  customerEmail?: string;
}

/** The processor callbacks we care about, normalized away from any vendor shape. */
export type PaymentEventType =
  | "payment.pending"
  | "payment.succeeded"
  | "payment.failed"
  | "payment.refunded";

/** A verified, normalized webhook event — the only thing the route acts on. */
export interface PaymentWebhookEvent {
  type: PaymentEventType;
  /** Store the intent belongs to — carried in processor metadata at creation. */
  storeId: string;
  /** Processor intent id (matches `order.paymentIntent`). */
  paymentIntentId: string;
  /** Order the intent settles, when the processor echoes our metadata. */
  orderId?: string;
}

/**
 * A storefront payment provider. The MVP ships a no-op stub; a high-risk
 * processor implements the same three methods and the call sites don't move.
 */
export interface PaymentProvider {
  /** Stable id stamped onto every `PaymentIntent.provider`. */
  readonly id: string;
  /** Open an intent for an order, or `null` to leave it settled-offline (pending). */
  createIntent(
    storeId: string,
    input: CreatePaymentIntentInput,
  ): Promise<PaymentIntent | null>;
  /** Verify + normalize a raw webhook body, or `null` if it can't be trusted. */
  parseWebhook(rawBody: string, signature: string | null): PaymentWebhookEvent | null;
}

/* ============================================================
   Stream 2 — platform billing (merchant → Offshelf)
   ============================================================ */

/** A selectable plan. `free` / `standard` are placeholders until billing is live. */
export interface PlanDefinition {
  id: SubscriptionPlan;
  name: string;
  /** Monthly price in whole currency units; `0` for free. Placeholder figures. */
  priceMonthly: number;
  currency: string;
  /** Short marketing bullets shown on the billing card. */
  features: string[];
  /**
   * Max stores an account on this plan may own — the multi-store entitlement
   * (`free` is single-store; `standard` unlocks more). Enforced server-side in the
   * `createStore` action via `storeCapForPlan`; surfaced as the switcher's upgrade lock.
   */
  storeCap: number;
}

/**
 * Reserved shape for `subscription.billingSeam` (persisted as Mixed today, `{}`
 * until a processor fills it). Typing it here documents the contract without
 * forcing the field to be populated in the MVP.
 */
export interface BillingSeam {
  /** Processor-side customer id (e.g. `cus_…`). */
  customerId?: string;
  /** Processor-side subscription id. */
  subscriptionId?: string;
  /** Which billing provider owns the records above. */
  provider?: string;
  /** Last known processor status, mirrored for display. */
  externalStatus?: string;
}

/** A hosted billing-portal handoff — `null` everywhere until billing is wired. */
export interface BillingPortalSession {
  url: string;
  provider: string;
}

/** A platform-billing provider — provisions subscriptions and serves the portal. */
export interface BillingProvider {
  readonly id: string;
  /** Hosted-portal URL for a merchant to manage their plan, or `null` if stubbed. */
  getPortalSession(storeId: string): Promise<BillingPortalSession | null>;
}
