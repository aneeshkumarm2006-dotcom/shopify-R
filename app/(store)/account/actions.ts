"use server";

import { revalidatePath } from "next/cache";
import type { Address, CartItem, PublicCustomer } from "@/types";
import {
  authenticateCustomer,
  registerCustomer,
  addCustomerAddress,
  removeCustomerAddress,
  toPublicCustomer,
  getProductsByIds,
  getCart,
  saveCart,
  mergeCartItems,
  customerCartKey,
  recordError,
  CustomerAuthError,
} from "@/lib/data";
import { resolveStorefront } from "@/lib/tenant/resolve";
import {
  setCustomerSession,
  clearCustomerSession,
  getCurrentCustomer,
} from "@/lib/customer/session";

/**
 * Storefront account actions (Phase 3). All run for the resolved tenant — the
 * `storeId` comes from the request subdomain via `resolveStorefront()`, NEVER the
 * client, so a shopper can only ever register/sign in against the store they're
 * visiting (PRD §9). Sessions live in the separate signed customer cookie.
 */

/** A cart line rebuilt from the catalog (authoritative price/title) for the client. */
export interface AccountCartLine {
  productId: string;
  variantId: string;
  handle: string;
  title: string;
  variant?: string;
  price: number;
  image?: string | null;
  quantity: number;
}

export interface AccountAuthResult {
  ok: boolean;
  error?: string;
  customer?: PublicCustomer;
  /** The merged cart (anonymous + saved), rebuilt from the catalog, for the client. */
  cart?: AccountCartLine[];
}

/**
 * Merge the shopper's anonymous cart with their saved (customer-keyed) cart, persist
 * the union under the customer key, and rebuild authoritative display lines from the
 * catalog (dropping any product/variant that no longer exists).
 */
async function mergeAndBuildCart(
  storeId: string,
  customerId: string,
  incoming: CartItem[],
): Promise<AccountCartLine[]> {
  const saved = (await getCart(storeId, customerCartKey(customerId))).items;
  const merged = mergeCartItems(incoming, saved);
  await saveCart(storeId, customerCartKey(customerId), merged);

  const ids = [...new Set(merged.map((i) => i.productId))];
  const products = await getProductsByIds(storeId, ids);
  const byId = new Map(products.map((p) => [p._id, p]));

  const lines: AccountCartLine[] = [];
  for (const item of merged) {
    const product = byId.get(item.productId);
    const variant = product?.variants.find((v) => v.id === item.variantId);
    if (!product || !variant) continue; // stale — drop silently
    lines.push({
      productId: product._id,
      variantId: variant.id,
      handle: product.handle,
      title: product.title,
      ...(product.variants.length > 1 ? { variant: variant.title } : {}),
      price: variant.price,
      image: product.images[0] ?? null,
      quantity: item.quantity,
    });
  }
  return lines;
}

export async function registerAccount(input: {
  name: string;
  email: string;
  password: string;
  cart?: CartItem[];
}): Promise<AccountAuthResult> {
  const store = await resolveStorefront();
  if (!store) return { ok: false, error: "This store isn't available right now." };
  try {
    const customer = await registerCustomer(store._id, {
      name: input.name,
      email: input.email,
      password: input.password,
    });
    await setCustomerSession(customer._id, store._id);
    const cart = await mergeAndBuildCart(store._id, customer._id, input.cart ?? []);
    return { ok: true, customer: toPublicCustomer(customer), cart };
  } catch (err) {
    if (err instanceof CustomerAuthError) return { ok: false, error: err.message };
    await recordError({
      source: "account.register",
      message: err instanceof Error ? err.message : "Unknown registration error",
      stack: err instanceof Error ? err.stack : null,
      severity: "error",
      storeId: store._id,
    });
    return { ok: false, error: "We couldn't create your account. Please try again." };
  }
}

export async function loginAccount(input: {
  email: string;
  password: string;
  cart?: CartItem[];
}): Promise<AccountAuthResult> {
  const store = await resolveStorefront();
  if (!store) return { ok: false, error: "This store isn't available right now." };
  const customer = await authenticateCustomer(store._id, input.email, input.password);
  if (!customer) return { ok: false, error: "Incorrect email or password." };
  await setCustomerSession(customer._id, store._id);
  const cart = await mergeAndBuildCart(store._id, customer._id, input.cart ?? []);
  return { ok: true, customer: toPublicCustomer(customer), cart };
}

export async function logoutAccount(): Promise<{ ok: boolean }> {
  await clearCustomerSession();
  revalidatePath("/account");
  return { ok: true };
}

/** Add a saved address to the signed-in customer's address book. */
export async function saveAddress(address: Address): Promise<{ ok: boolean; error?: string }> {
  const store = await resolveStorefront();
  if (!store) return { ok: false, error: "This store isn't available right now." };
  const customer = await getCurrentCustomer(store);
  if (!customer) return { ok: false, error: "Please sign in." };
  if (!address.name.trim() || !address.address.trim()) {
    return { ok: false, error: "Name and address are required." };
  }
  const updated = await addCustomerAddress(store._id, customer._id, address);
  if (!updated) return { ok: false, error: "Couldn't save the address." };
  revalidatePath("/account");
  return { ok: true };
}

/** Remove a saved address by index from the signed-in customer's address book. */
export async function deleteAddress(index: number): Promise<{ ok: boolean; error?: string }> {
  const store = await resolveStorefront();
  if (!store) return { ok: false, error: "This store isn't available right now." };
  const customer = await getCurrentCustomer(store);
  if (!customer) return { ok: false, error: "Please sign in." };
  const updated = await removeCustomerAddress(store._id, customer._id, index);
  if (!updated) return { ok: false, error: "Couldn't remove the address." };
  revalidatePath("/account");
  return { ok: true };
}
