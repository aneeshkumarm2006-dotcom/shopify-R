import type { Order, Store } from "@/types";
import { isEmailConfigured, sendEmail } from "./client";
import { renderOrderConfirmationEmail } from "./templates";

/**
 * High-level transactional notifications (Stage 13, PRD §11).
 *
 * These are the functions the rest of the app calls. They are **failure-tolerant
 * by contract** — they never throw and never return a rejected promise — so a
 * caller (e.g. `placeOrder`) can await one without any chance of a mail problem
 * undoing the work that triggered it. Each returns a small result for
 * logging/telemetry only; the caller is expected to ignore it.
 */

export interface NotificationResult {
  sent: boolean;
  /** Why it didn't send (unconfigured, no recipient, or a swallowed error). */
  reason?: string;
  /** Resend message id when `sent`. */
  id?: string;
}

/**
 * Send the order-confirmation email for a freshly-placed order.
 *
 * No-ops cleanly when Resend is unconfigured (`isEmailConfigured()` is false) or
 * the order has no contact email. Any render/transport error is caught and logged
 * — never propagated — so order creation is unaffected (TODO Stage 13 acceptance:
 * "send failures don't block order creation").
 */
export async function sendOrderConfirmation(
  store: Store,
  order: Order,
): Promise<NotificationResult> {
  if (!isEmailConfigured()) return { sent: false, reason: "email not configured" };

  const to = order.contact.email?.trim();
  if (!to) return { sent: false, reason: "order has no contact email" };

  try {
    const { subject, html, text } = renderOrderConfirmationEmail({ store, order });
    const { id } = await sendEmail({
      to,
      subject,
      html,
      text,
      fromName: store.name,
      ...(store.settings.contactEmail ? { replyTo: store.settings.contactEmail } : {}),
    });
    return { sent: true, id };
  } catch (err) {
    // Best-effort: a confirmation email must never block or fail an order.
    console.error(
      `[email] order #${order.orderNumber} confirmation failed:`,
      err instanceof Error ? err.message : err,
    );
    return { sent: false, reason: "send failed" };
  }
}
