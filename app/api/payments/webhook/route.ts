import { NextResponse } from "next/server";
import { handlePaymentWebhook } from "@/lib/payments";
import { recordError } from "@/lib/data";

/**
 * Storefront payment webhook stub (Stage 12, PRD §6.11).
 *
 * The reserved callback URL a future high-risk processor POSTs settlement events
 * to. Today it is a **stub**: with no processor configured, `handlePaymentWebhook`
 * trusts nothing and returns `handled: false`, so this always 200s (a webhook
 * endpoint must ack deliveries so the sender doesn't retry-storm) without mutating
 * any order. When a processor is wired, the SAME handler verifies the signature
 * and reconciles the order's `paymentStatus` — the route never changes.
 *
 * Runs on the Node.js runtime so the handler can reach the Mongoose-backed orders
 * data layer for tenant-scoped reconciliation.
 */
export const runtime = "nodejs";

export async function POST(req: Request): Promise<NextResponse> {
  const rawBody = await req.text();
  // Common processor signature headers; the active provider verifies as needed.
  const signature =
    req.headers.get("x-payment-signature") ?? req.headers.get("stripe-signature");

  try {
    const result = await handlePaymentWebhook(rawBody, signature);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    // Log the failure to the operator incident feed, but still 200 so the processor
    // doesn't retry-storm (the event is captured for a human to investigate).
    await recordError({
      source: "payment.webhook",
      message: err instanceof Error ? err.message : "Webhook handler threw",
      stack: err instanceof Error ? err.stack : null,
      severity: "error",
      metadata: { hasSignature: Boolean(signature) },
    });
    return NextResponse.json({ handled: false }, { status: 200 });
  }
}
