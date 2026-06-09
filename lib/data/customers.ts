import type { Address, Customer } from "@/types";
import { mockCustomers } from "./mocks";
import { resolve, scoped } from "./_util";
import { isDbConfigured, Customers } from "@/lib/db";

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
