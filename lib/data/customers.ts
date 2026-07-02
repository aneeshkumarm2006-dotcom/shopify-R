import type { Address, Customer, PublicCustomer } from "@/types";
import { mockCustomers } from "./mocks";
import { resolve, scoped } from "./_util";
import { isDbConfigured, Customers } from "@/lib/db";
import { hashPassword, verifyPassword, dummyVerify } from "@/lib/auth/password";
import { normalizeTag } from "./segments";

/** Strip the password hash so a customer record is safe to hand a client component. */
export function toPublicCustomer(customer: Customer): PublicCustomer {
  const { passwordHash: _omit, ...safe } = customer;
  void _omit;
  return safe;
}

/** Customers for a store (PRD §6.8). */
export async function getCustomers(storeId: string): Promise<Customer[]> {
  if (!isDbConfigured()) return resolve(scoped(mockCustomers, storeId));
  return Customers.findMany(storeId, {}, { sort: { createdAt: -1 } });
}

export async function getCustomer(storeId: string, id: string): Promise<Customer | null> {
  if (!isDbConfigured()) {
    const found = scoped(mockCustomers, storeId).find((c) => c._id === id);
    return found ? resolve(found) : null;
  }
  return Customers.findById(storeId, id);
}

/** Match a customer by email within a store (upsert key for checkout, PRD §6.6). */
export async function getCustomerByEmail(
  storeId: string,
  email: string,
): Promise<Customer | null> {
  if (!isDbConfigured()) {
    const found = scoped(mockCustomers, storeId).find(
      (c) => c.email.toLowerCase() === email.toLowerCase(),
    );
    return found ? resolve(found) : null;
  }
  // Emails are stored lowercased (unique per store), so match on the normalized form.
  return Customers.findOne(storeId, { email: email.toLowerCase() });
}

/* ============================================================
   Writes (Stage 10, PRD §6.6/§6.8) — checkout matches-or-creates a customer per
   store by email, then keeps the denormalized analytics totals in step on each
   order. Both are scoped through the `Customers` repository (storeId enforced).
   ============================================================ */

/**
 * Find a store's customer by email or create one (PRD §6.6 "create or match by
 * email within store"). On a match, a previously-unseen shipping address is
 * appended so the customer's saved addresses grow over time. Emails are unique
 * per store (not globally), enforced by the `(storeId, email)` index.
 */
export async function findOrCreateCustomer(
  storeId: string,
  input: { email: string; name: string; phone?: string; address?: Address },
): Promise<Customer> {
  const email = input.email.toLowerCase();

  if (!isDbConfigured()) {
    // Mock mode: synthesize a customer record so the demo checkout flow completes.
    const stamp = new Date().toISOString();
    const existing = scoped(mockCustomers, storeId).find(
      (c) => c.email.toLowerCase() === email,
    );
    if (existing) return resolve(existing);
    return resolve({
      _id: `cust_${Math.random().toString(36).slice(2, 10)}`,
      storeId,
      email,
      name: input.name,
      ...(input.phone ? { phone: input.phone } : {}),
      addresses: input.address ? [input.address] : [],
      orderCount: 0,
      totalSpent: 0,
      createdAt: stamp,
      updatedAt: stamp,
    });
  }

  const existing = await Customers.findOne(storeId, { email });
  if (existing) {
    // Append the address only if it's new (compare on the street string).
    if (
      input.address &&
      !existing.addresses.some((a) => a.address === input.address!.address)
    ) {
      const updated = await Customers.updateOne(
        storeId,
        { _id: existing._id },
        { $push: { addresses: input.address } },
      );
      return updated ?? existing;
    }
    return existing;
  }

  return Customers.create(storeId, {
    email,
    name: input.name,
    ...(input.phone ? { phone: input.phone } : {}),
    addresses: input.address ? [input.address] : [],
    orderCount: 0,
    totalSpent: 0,
  });
}

/* ============================================================
   Storefront accounts (Phase 3) — customer self-service auth, separate from the
   merchant NextAuth identity. Emails are unique per store, so an account is the same
   record a checkout would match/create; registering just attaches a password to it.
   ============================================================ */

/** Why a customer registration was rejected — surfaced inline on the account form. */
export class CustomerAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CustomerAuthError";
  }
}

/**
 * Register a storefront account (Phase 3). If the email already has a password, it's a
 * duplicate (reject — the shopper should sign in). If a passwordless record exists
 * (created at checkout), attach the password and adopt the name. Otherwise create a
 * fresh customer. Requires a DB; in mock mode it throws a friendly error.
 */
export async function registerCustomer(
  storeId: string,
  input: { email: string; name: string; password: string },
): Promise<Customer> {
  if (!isDbConfigured()) {
    throw new CustomerAuthError("Accounts aren't available in this environment.");
  }
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!email || !name) throw new CustomerAuthError("Name and email are required.");
  if (input.password.length < 8) {
    throw new CustomerAuthError("Password must be at least 8 characters.");
  }

  const passwordHash = await hashPassword(input.password);
  const existing = await Customers.findOne(storeId, { email });
  if (existing) {
    if (existing.passwordHash) {
      throw new CustomerAuthError("An account with this email already exists.");
    }
    const updated = await Customers.updateOne(
      storeId,
      { _id: existing._id },
      { $set: { passwordHash, name } },
    );
    return updated ?? existing;
  }

  return Customers.create(storeId, {
    email,
    name,
    addresses: [],
    orderCount: 0,
    totalSpent: 0,
    passwordHash,
  });
}

/**
 * Verify storefront credentials (Phase 3). Returns the customer on a match, or null
 * for an unknown email, a passwordless (checkout-only) account, or a wrong password —
 * the caller maps all three to one generic message, leaking no oracle.
 */
export async function authenticateCustomer(
  storeId: string,
  email: string,
  password: string,
): Promise<Customer | null> {
  if (!isDbConfigured()) return null;
  const customer = await Customers.findOne(storeId, { email: email.trim().toLowerCase() });
  if (!customer?.passwordHash) {
    await dummyVerify(password); // equalize timing so absent accounts aren't distinguishable
    return null;
  }
  const ok = await verifyPassword(password, customer.passwordHash);
  return ok ? customer : null;
}

/** Append a saved address to a customer (Phase 3 account book). Deduped on street. */
export async function addCustomerAddress(
  storeId: string,
  customerId: string,
  address: Address,
): Promise<Customer | null> {
  if (!isDbConfigured()) return null;
  const existing = await Customers.findById(storeId, customerId);
  if (!existing) return null;
  if (existing.addresses.some((a) => a.address === address.address)) return existing;
  return Customers.updateOne(
    storeId,
    { _id: customerId },
    { $push: { addresses: address } },
  );
}

/** Remove a saved address by index (Phase 3 account book). */
export async function removeCustomerAddress(
  storeId: string,
  customerId: string,
  index: number,
): Promise<Customer | null> {
  if (!isDbConfigured()) return null;
  const existing = await Customers.findById(storeId, customerId);
  if (!existing) return null;
  const addresses = existing.addresses.filter((_, i) => i !== index);
  return Customers.updateOne(storeId, { _id: customerId }, { $set: { addresses } });
}

/** Set a customer's segmentation tags (Phase 5), normalized + de-duplicated. */
export async function setCustomerTags(
  storeId: string,
  customerId: string,
  tags: string[],
): Promise<Customer | null> {
  if (!isDbConfigured()) return null;
  const clean = [...new Set(tags.map((t) => normalizeTag(t)).filter(Boolean))];
  return Customers.updateOne(storeId, { _id: customerId }, { $set: { tags: clean } });
}

/** Distinct tags in use across a store's customers (for the segment filter UI). */
export async function getCustomerTags(storeId: string): Promise<string[]> {
  if (!isDbConfigured()) return [];
  const rows = await Customers.findMany(storeId);
  const tags = new Set<string>();
  for (const c of rows) for (const t of c.tags ?? []) tags.add(t);
  return [...tags].sort((a, b) => a.localeCompare(b));
}

/**
 * Update the denormalized analytics counters after an order is placed (PRD §5.9):
 * one more order, and `totalSpent` grown by the order total. Atomic `$inc` so
 * concurrent orders for the same customer can't clobber each other.
 */
export async function recordCustomerOrder(
  storeId: string,
  customerId: string,
  orderTotal: number,
): Promise<void> {
  if (!isDbConfigured()) return;
  await Customers.updateOne(
    storeId,
    { _id: customerId },
    { $inc: { orderCount: 1, totalSpent: orderTotal } },
  );
}
