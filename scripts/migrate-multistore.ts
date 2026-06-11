/**
 * Multi-store migration (one-time, idempotent).
 *
 * Moves the `users` collection from the single-store model to multi-store:
 *   1. Drop the legacy UNIQUE index on `users.storeId` (`storeId_1`) if present —
 *      it enforced one-store-per-account and would block a user owning a 2nd store.
 *   2. `$rename` `users.storeId` → `users.activeStoreId` (the currently-selected store).
 *   3. Backfill `users.primaryStoreId` from `activeStoreId` — today every user owns
 *      exactly one store, so primary == active == their only store.
 *   4. `syncIndexes()` so the new shape (sparse non-unique `activeStoreId` /
 *      `primaryStoreId`, indexed `stores.ownerId`) matches the schema.
 *
 * Safe to re-run: each step checks current state first, so a second run is a no-op.
 * Run:  npm run migrate:multistore   (reads MONGODB_URI from .env.local / .env)
 */
import mongoose from "mongoose";

function loadEnv() {
  const loader = (process as unknown as { loadEnvFile?: (p: string) => void }).loadEnvFile;
  for (const file of [".env.local", ".env"]) {
    try {
      loader?.(file);
    } catch {
      /* file absent — ignore */
    }
  }
}

// Load env BEFORE importing the DB layer: `lib/db/connect` captures MONGODB_URI at
// module-evaluation time, so the dynamic import below must run after loadEnv().
loadEnv();

async function main() {
  const { dbConnect, UserModel, StoreModel } = await import("@/lib/db");
  await dbConnect();
  const users = UserModel.collection;

  // 1. Drop the legacy unique index on storeId, if it still exists.
  const indexes = await users.indexes();
  const legacy = indexes.find((ix) => ix.name === "storeId_1");
  if (legacy) {
    await users.dropIndex("storeId_1");
    console.log("✓ dropped legacy unique index users.storeId_1");
  } else {
    console.log("· no legacy users.storeId_1 index (already migrated or fresh DB)");
  }

  // 2. Rename storeId → activeStoreId for any doc that still has the old field.
  const renamed = await users.updateMany(
    { storeId: { $exists: true } },
    { $rename: { storeId: "activeStoreId" } },
  );
  console.log(`✓ renamed storeId → activeStoreId on ${renamed.modifiedCount} user(s)`);

  // 3. Backfill primaryStoreId from activeStoreId where it's missing.
  const backfilled = await users.updateMany(
    { primaryStoreId: { $exists: false }, activeStoreId: { $exists: true } },
    [{ $set: { primaryStoreId: "$activeStoreId" } }],
  );
  console.log(`✓ backfilled primaryStoreId on ${backfilled.modifiedCount} user(s)`);

  // 4. Sync indexes to the current schema (sparse activeStoreId/primaryStoreId,
  //    indexed stores.ownerId). Drops the now-unused unique constraint definition.
  await Promise.all([UserModel.syncIndexes(), StoreModel.syncIndexes()]);
  console.log("✓ synced User + Store indexes");

  console.log("✓ multi-store migration complete");
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("✗ migration failed:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
