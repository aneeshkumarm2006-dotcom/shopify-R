"use server";

import { cookies } from "next/headers";
import type { Address, CartItem } from "@/types";
import { placeOrder, saveCart, CheckoutError } from "@/lib/data";
import { resolveStorefront } from "@/lib/tenant/resolve";

/**
 * Storefront customer actions (Stage 10, PRD §6.6). These run server-side for the
 * currently-resolved tenant — the `storeId` comes from the request subdomain via
 * `resolveStorefront()`, NEVER from the client, so a customer can only ever write
 * into the store they're visiting (PRD §9). The cart only sends item references +
 * quantities; checkout re-derives authoritative prices from the catalog.
 */

/** Age-gate cookie set by the storefront age gate (Stage 8). */
const AGE_COOKIE = "offshelf_age_verified";

interface SubmitOrderInput {
  email: string;
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone?: string;
  sessionId?: string;
  lines: { productId: string; variantId: string; quantity: number }[];
}

export interface SubmitOrderResult {
  ok: boolean;
  orderNumber?: number;
  total?: number;
  error?: string;
}

export async function submitOrder(input: SubmitOrderInput): Promise<SubmitOrderResult> {
  const store = await resolveStorefront();
  if (!store) return { ok: false, error: "This store isn't available right now." };

  const name = `${input.firstName} ${input.lastName}`.trim();
  // MVP collects a single address; contact + shipping share it.
  const fullAddress = `${input.address}, ${input.city}, ${input.state} ${input.zip}`.trim();
  const party: Address = {
    name,
    email: input.email.trim(),
    ...(input.phone?.trim() ? { phone: input.phone.trim() } : {}),
    address: fullAddress,
  };

  // Trust the age stamp from the gate cookie, not the client form.
  const ageVerifiedAt =
    (await cookies()).get(AGE_COOKIE)?.value || new Date().toISOString();

  try {
    const placed = await placeOrder(store._id, {
      contact: party,
      shippingAddress: party,
      ageVerifiedAt,
      lines: input.lines,
      currency: store.settings.currency,
      ...(input.sessionId ? { sessionId: input.sessionId } : {}),
    });
    return { ok: true, orderNumber: placed.orderNumber, total: placed.total };
  } catch (err) {
    if (err instanceof CheckoutError) return { ok: false, error: err.message };
    return { ok: false, error: "We couldn't place your order. Please try again." };
  }
}

/**
 * Persist the session cart to the `carts` collection (PRD §5.7). Fire-and-forget
 * from the storefront client whenever the cart changes — the browser keeps an
 * instant local copy, this mirrors it server-side. Best-effort: a failure never
 * blocks shopping, so the result is a simple boolean.
 */
export async function syncCart(
  sessionId: string,
  items: CartItem[],
): Promise<{ ok: boolean }> {
  const store = await resolveStorefront();
  if (!store || !sessionId) return { ok: false };
  try {
    await saveCart(store._id, sessionId, items);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
