import { dbConnect } from "./connect";
import { requireStoreId } from "./scope";
import { CounterModel } from "./models/counter";

/**
 * Atomic per-store sequential order number (PRD §11 Q4, TODO Stage 6).
 *
 * A single `findOneAndUpdate` with `$inc` is atomic at the document level in
 * MongoDB, so two concurrent checkouts for the same store can never receive the
 * same number, and the sequence has no gaps. The counter is keyed by store, so
 * each tenant has its own independent run.
 */
function orderCounterKey(storeId: string): string {
  return `order:${requireStoreId(storeId)}`;
}

export async function nextOrderNumber(storeId: string): Promise<number> {
  await dbConnect();
  const doc = await CounterModel.findByIdAndUpdate(
    orderCounterKey(storeId),
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();
  // `new + upsert` guarantees a document; narrow the loose lean type.
  return (doc as unknown as { seq: number }).seq;
}

/**
 * Seed/align a store's order counter to a known high-water mark (used by the seed
 * script so freshly placed orders continue *after* the imported fixtures rather
 * than colliding with them). Never lowers an existing counter.
 */
export async function setOrderCounterFloor(storeId: string, floor: number): Promise<void> {
  await dbConnect();
  await CounterModel.findByIdAndUpdate(
    orderCounterKey(storeId),
    { $max: { seq: floor } },
    { upsert: true, setDefaultsOnInsert: true },
  );
}
