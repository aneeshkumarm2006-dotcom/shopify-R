import { mockOrders } from "./mocks";
import { scoped } from "./_util";
import { isDbConfigured, nextOrderNumber as dbNextOrderNumber } from "@/lib/db";

/**
 * Allocate the next sequential, per-store order number (PRD §11 Q4).
 *
 * Backed by the atomic MongoDB counter (`lib/db/counter.ts`) so concurrent
 * checkouts never collide and the sequence is gap-free. Consumed by order
 * creation in Stage 10; exposed here so it follows the same storeId-first
 * data-access contract as every other seam. The mock fallback continues the
 * fixture sequence for Part A.
 */
export async function getNextOrderNumber(storeId: string): Promise<number> {
  if (!isDbConfigured()) {
    const highest = scoped(mockOrders, storeId).reduce(
      (max, o) => Math.max(max, o.orderNumber),
      1000,
    );
    return highest + 1;
  }
  return dbNextOrderNumber(storeId);
}
