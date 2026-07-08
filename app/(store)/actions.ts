"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import type { Address, CartItem, SettlementMethod } from "@/types";
import {
  placeOrder,
  saveCart,
  validateDiscount,
  recordError,
  CheckoutError,
  createReview,
  getProductByHandle,
  validateGiftCard,
  applyGiftCard,
  searchProducts,
} from "@/lib/data";
import { resolveStorefront } from "@/lib/tenant/resolve";
import { getCurrentCustomer } from "@/lib/customer/session";

/**
 * Storefront customer actions (Stage 10, PRD §6.6). These run server-side for the
 * currently-resolved tenant — the `storeId` comes from the request subdomain via
 * `resolveStorefront()`, NEVER from the client, so a customer can only ever write
 * into the store they're visiting (PRD §9). The cart only sends item references +
 * quantities; checkout re-derives authoritative prices from the catalog.
 */

/** Age-gate cookie set by the storefront age gate (Stage 8). */
const AGE_COOKIE = "offshelf_age_verified";

/**
 * IP-keyed throttle for the unauthenticated storefront commerce endpoints. Guards
 * order-spam (checkout) and code-guessing oracles (discount / gift-card preview both
 * reveal whether a code exists). Fails closed so a DB blip can't disable it.
 */
async function allowStorefront(keyPrefix: string, limit: number, windowSeconds: number): Promise<boolean> {
  const { checkRateLimit } = await import("@/lib/rate-limit");
  const { getClientIp } = await import("@/lib/request-meta");
  const { allowed } = await checkRateLimit({
    key: `${keyPrefix}:${await getClientIp()}`,
    limit,
    windowSeconds,
    failClosed: true,
  });
  return allowed;
}

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
  /** Promo code typed at checkout. Re-validated server-side by `placeOrder`. */
  discountCode?: string;
  /** How the customer settles — re-checked against the store's enabled methods. */
  settlementMethod?: SettlementMethod;
  /** Chosen shipping rate id — re-priced server-side from store settings. */
  shippingRateId?: string;
  /** Gift-card code — validated + redeemed server-side by `placeOrder`. */
  giftCardCode?: string;
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
  if (!(await allowStorefront(`checkout:${store._id}`, 15, 600))) {
    return { ok: false, error: "Too many attempts. Please wait a moment and try again." };
  }

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
      // The shipping region drives region tax + rate matching; comes from the state field.
      ...(input.state?.trim() ? { region: input.state.trim() } : {}),
      ...(input.sessionId ? { sessionId: input.sessionId } : {}),
      ...(input.discountCode?.trim() ? { discountCode: input.discountCode.trim() } : {}),
      ...(input.settlementMethod ? { settlementMethod: input.settlementMethod } : {}),
      ...(input.shippingRateId?.trim() ? { shippingRateId: input.shippingRateId.trim() } : {}),
      ...(input.giftCardCode?.trim() ? { giftCardCode: input.giftCardCode.trim() } : {}),
    });
    return { ok: true, orderNumber: placed.orderNumber, total: placed.total };
  } catch (err) {
    if (err instanceof CheckoutError) return { ok: false, error: err.message };
    // Unexpected failure — log it to the operator incident feed (best-effort).
    await recordError({
      source: "checkout",
      message: err instanceof Error ? err.message : "Unknown checkout error",
      stack: err instanceof Error ? err.stack : null,
      severity: "critical",
      storeId: store._id,
      metadata: { lineCount: input.lines.length },
    });
    return { ok: false, error: "We couldn't place your order. Please try again." };
  }
}

/**
 * Validate a promo code against the live cart subtotal for the resolved tenant
 * (PRD §6.6). Returns a serializable preview the checkout UI can DISPLAY — the
 * authoritative discount is re-validated inside `placeOrder`, so a tampered amount
 * here can never change what the customer is actually charged. The rejection
 * `reason` is passed back raw; the client maps it to friendly copy.
 */
export async function applyDiscount(
  code: string,
  subtotal: number,
): Promise<{ ok: boolean; amount?: number; code?: string; reason?: string }> {
  const store = await resolveStorefront();
  if (!store) return { ok: false, reason: "not_found" };
  if (!code.trim()) return { ok: false, reason: "not_found" };
  // Tight limit: this is a code-existence oracle — throttle guessing/enumeration.
  if (!(await allowStorefront(`codeprobe:${store._id}`, 20, 60))) {
    return { ok: false, reason: "rate_limited" };
  }

  const result = await validateDiscount(store._id, code, subtotal);
  if (result.ok) return { ok: true, amount: result.amount, code: result.code };
  return { ok: false, reason: result.reason };
}

/**
 * Validate a gift-card code and PREVIEW how much it would apply against an amount due
 * (Phase 4). Display-only — the authoritative draw-down happens atomically inside
 * `placeOrder`, so a tampered preview can't change what's actually charged. Returns
 * the card's current balance + the amount it would cover, or a typed rejection reason.
 */
export async function previewGiftCard(
  code: string,
  amountDue: number,
): Promise<{ ok: boolean; balance?: number; applies?: number; code?: string; reason?: string }> {
  const store = await resolveStorefront();
  if (!store || !code.trim()) return { ok: false, reason: "not_found" };
  // Tight limit: this is a code-existence + balance oracle — throttle guessing.
  if (!(await allowStorefront(`codeprobe:${store._id}`, 20, 60))) {
    return { ok: false, reason: "rate_limited" };
  }

  const result = await validateGiftCard(store._id, code);
  if (!result.ok) return { ok: false, reason: result.reason };
  const applies = applyGiftCard(result.card.balance, Math.max(0, amountDue)).applied;
  return { ok: true, balance: result.card.balance, applies, code: result.card.code };
}

/**
 * Post a product review (Phase 4) for the resolved tenant. The product is re-fetched
 * server-side (must exist + be active) and a signed-in shopper's identity is taken
 * from the customer session, never the form — so authorship can't be spoofed for a
 * logged-in account. Reviews auto-publish; merchants moderate from the admin.
 */
export async function submitReview(input: {
  handle: string;
  rating: number;
  authorName: string;
  title?: string;
  body: string;
}): Promise<{ ok: boolean; error?: string }> {
  const store = await resolveStorefront();
  if (!store) return { ok: false, error: "This store isn't available right now." };

  if (!input.body.trim()) return { ok: false, error: "Please write a few words." };
  if (!(input.rating >= 1 && input.rating <= 5)) return { ok: false, error: "Pick a star rating." };

  const product = await getProductByHandle(store._id, input.handle);
  if (!product || product.status !== "active") return { ok: false, error: "Product not found." };

  const customer = await getCurrentCustomer(store);
  const authorName = (customer?.name || input.authorName || "").trim();
  if (!authorName) return { ok: false, error: "Please add your name." };

  const created = await createReview(store._id, {
    productId: product._id,
    customerId: customer?._id ?? null,
    authorName,
    rating: input.rating,
    ...(input.title?.trim() ? { title: input.title.trim() } : {}),
    body: input.body,
  });
  if (!created) return { ok: false, error: "Reviews aren't available in this environment." };

  revalidatePath(`/products/${input.handle}`);
  return { ok: true };
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

/** One predictive-search hit — the minimal shape the header dropdown renders. */
export interface SearchSuggestion {
  handle: string;
  title: string;
  productType?: string;
  price: number;
  image: string | null;
}

/**
 * Predictive search for the header dropdown: active-only matches for the tenant
 * resolved from the request subdomain (never a client-supplied storeId). Returns a
 * small, render-ready slice (top matches, lowest variant price, first image) so the
 * client shows instant results as the shopper types without shipping the catalog.
 */
export async function searchSuggest(query: string): Promise<SearchSuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const store = await resolveStorefront();
  if (!store) return [];
  const rows = await searchProducts(store._id, { q, status: "active", sort: "newest" });
  return rows.slice(0, 6).map((p) => ({
    handle: p.handle,
    title: p.title,
    productType: p.productType,
    price: p.variants.length ? Math.min(...p.variants.map((v) => v.price)) : 0,
    image: p.images[0] ?? null,
  }));
}
