import type { PaymentStatus } from "@/types";
import type {
  CreatePaymentIntentInput,
  PaymentIntent,
  PaymentProvider,
  PaymentWebhookEvent,
} from "./types";
import { setOrderPaymentStatusByIntent } from "@/lib/data/orders";

/**
 * Storefront payment seam (Stage 12, PRD §6.11 — customer → merchant).
 *
 * ### Graceful degradation (mirrors `isDbConfigured()` / `isCloudinaryConfigured()`)
 * With `PAYMENTS_PROVIDER` unset, `isPaymentProcessorConfigured()` is false: the
 * stub provider opens **no** intent (`createIntent` → `null`), so orders stay
 * `paymentStatus: pending` and are settled offline (PRD §2.3). Set the env var
 * and a real provider takes over with **no call-site changes** — checkout already
 * calls `createPaymentIntent`, and the webhook route already calls
 * `handlePaymentWebhook`.
 *
 * No card data is ever collected in the MVP: the checkout screen has no card
 * fields (DESIGN §8), and this module never sees a PAN — only opaque intent ids.
 */

const PROVIDER_ID = process.env.PAYMENTS_PROVIDER ?? "";

/** True once a high-risk processor is configured. Stub mode otherwise. */
export function isPaymentProcessorConfigured(): boolean {
  return Boolean(PROVIDER_ID);
}

/**
 * The MVP provider: a documented no-op. It mints no intents and trusts no
 * webhooks, which is exactly the "pending by default, settle offline" behavior
 * the PRD specifies. A real `PaymentProvider` replaces this object wholesale.
 */
const stubProvider: PaymentProvider = {
  id: "stub",
  async createIntent() {
    // No processor wired — leave the order settled-offline (pending).
    return null;
  },
  parseWebhook() {
    // Nothing is configured to send (or sign) events, so none are trusted.
    return null;
  },
};

/** The active provider. Swap-in point for a high-risk processor adapter. */
function activeProvider(): PaymentProvider {
  // When a real adapter exists it is selected here by `PROVIDER_ID`. Until then
  // the stub is the only implementation, so configuration just toggles behavior.
  return stubProvider;
}

/**
 * Checkout seam: (optionally) open a payment intent for a freshly-placed order.
 * Returns the intent to stamp onto `order.paymentIntent`, or `null` to leave the
 * order `pending`. Called from `lib/data/checkout.ts` — keeping the call here
 * means wiring a processor never touches the checkout orchestration.
 */
export async function createPaymentIntent(
  storeId: string,
  input: CreatePaymentIntentInput,
): Promise<PaymentIntent | null> {
  return activeProvider().createIntent(storeId, input);
}

/** Map a normalized webhook event onto an order lifecycle status. */
export function eventToPaymentStatus(type: PaymentWebhookEvent["type"]): PaymentStatus | null {
  switch (type) {
    case "payment.succeeded":
      return "paid";
    case "payment.refunded":
      return "refunded";
    case "payment.pending":
      return "pending";
    case "payment.failed":
      // No `failed` order status in the MVP enum — the order simply stays pending.
      return null;
    default:
      return null;
  }
}

/** Result of processing a webhook delivery — drives the route's HTTP response. */
export interface WebhookResult {
  handled: boolean;
  reason: string;
}

/**
 * Webhook seam: verify + normalize a raw processor delivery, then reconcile the
 * matching order's `paymentStatus`. In stub mode `parseWebhook` returns `null`,
 * so this acknowledges-and-ignores (a real processor's signature can't be forged
 * into our stub). When a provider is wired, the same path updates the order found
 * by `order.paymentIntent` within the event's store — no re-architecture needed.
 */
export async function handlePaymentWebhook(
  rawBody: string,
  signature: string | null,
): Promise<WebhookResult> {
  const event = activeProvider().parseWebhook(rawBody, signature);
  if (!event) {
    return { handled: false, reason: "no payment processor configured" };
  }

  const status = eventToPaymentStatus(event.type);
  if (!status) {
    return { handled: false, reason: `ignored event ${event.type}` };
  }

  // Tenant-scoped reconciliation: look the order up by its intent within the store the
  // processor told us about (carried in intent metadata at creation) AND, when the event
  // carries a captured amount, require it to match the order total — so a tampered/
  // replayed event can't confirm an order for the wrong amount.
  const order = await setOrderPaymentStatusByIntent(
    event.storeId,
    event.paymentIntentId,
    status,
    event.amount,
  );
  return order
    ? { handled: true, reason: `order ${order.orderNumber} → ${status}` }
    : { handled: false, reason: "no order matches payment intent (or amount mismatch)" };
}
