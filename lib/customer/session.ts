import { cookies } from "next/headers";
import type { Customer, Store } from "@/types";
import { getCustomer } from "@/lib/data/customers";
import { createCustomerToken, parseCustomerToken, CUSTOMER_TTL_DAYS } from "./token";

/**
 * Storefront CUSTOMER session (Phase 3) — deliberately separate from the merchant
 * NextAuth session. A storefront shopper's identity is per-store and lives in its own
 * signed, HttpOnly cookie (token + verification in `./token`). The `storeId` is baked
 * into the token and re-checked against the resolved tenant on every read, so a cookie
 * minted for one store can never authenticate a shopper on another (PRD §9).
 *
 * Server-only: reads/writes go through `next/headers` cookies, so this is imported
 * only from server components, route handlers, and server actions.
 */

const COOKIE = "offshelf_customer";

/** Set the signed customer session cookie (HttpOnly, Lax, 30-day). */
export async function setCustomerSession(customerId: string, storeId: string): Promise<void> {
  (await cookies()).set(COOKIE, createCustomerToken(customerId, storeId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: CUSTOMER_TTL_DAYS * 24 * 60 * 60,
  });
}

/** Clear the customer session cookie (logout). */
export async function clearCustomerSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/** The signed-in customer id for THIS store, or null. Rejects tokens bound elsewhere. */
export async function getSessionCustomerId(storeId: string): Promise<string | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  const parsed = parseCustomerToken(token);
  if (!parsed || parsed.storeId !== storeId) return null;
  return parsed.customerId;
}

/**
 * Resolve the full signed-in `Customer` for the resolved tenant, or null. Loads the
 * record store-scoped, so a stale cookie for a now-deleted customer resolves to null.
 */
export async function getCurrentCustomer(store: Store): Promise<Customer | null> {
  const customerId = await getSessionCustomerId(store._id);
  if (!customerId) return null;
  return getCustomer(store._id, customerId);
}
