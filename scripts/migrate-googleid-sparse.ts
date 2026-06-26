/**
 * One-off migration: make the `users.googleId` unique index SPARSE.
 *
 * The schema declares `googleId: { unique: true, sparse: true }` (lib/db/models/store.ts),
 * but a `googleId_1` index created before that change persists in MongoDB as a
 * NON-sparse unique index — and Mongoose never alters an existing index when only
 * its options change. A non-sparse unique index treats a missing field as
 * `googleId: null` and allows only ONE such document, so the second email+password
 * signup (credential users have no googleId) fails with:
 *   E11000 duplicate key error … index: googleId_1 dup key: { googleId: null }
 *
 * This drops the stale index and recreates it sparse, so any number of credential
 * users can coexist while OAuth users keep their unique googleId. Idempotent.
 *
 * Run:  node --env-file=.env.local --import tsx scripts/migrate-googleid-sparse.ts
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
loadEnv();

async function main() {
  const { dbConnect } = await import("@/lib/db");
  await dbConnect();
  const users = mongoose.connection.db!.collection("users");

  const indexes = await users.indexes();
  const existing = indexes.find((i) => i.name === "googleId_1");

  if (existing && existing.unique && existing.sparse) {
    console.log("· googleId_1 is already unique+sparse — nothing to do.");
    await mongoose.disconnect();
    return;
  }

  // Guard: a sparse index can't be built if duplicate non-null googleIds exist.
  const dupes = await users
    .aggregate([
      { $match: { googleId: { $ne: null } } },
      { $group: { _id: "$googleId", n: { $sum: 1 } } },
      { $match: { n: { $gt: 1 } } },
    ])
    .toArray();
  if (dupes.length) {
    console.error(`✗ refusing to migrate: ${dupes.length} duplicate non-null googleId value(s) exist.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  if (existing) {
    console.log(`→ dropping stale index googleId_1 (unique=${!!existing.unique} sparse=${!!existing.sparse})`);
    await users.dropIndex("googleId_1");
  }

  console.log("→ creating googleId_1 as { unique: true, sparse: true }");
  await users.createIndex({ googleId: 1 }, { unique: true, sparse: true, name: "googleId_1" });

  const after = (await users.indexes()).find((i) => i.name === "googleId_1");
  console.log(`✓ done — googleId_1: unique=${!!after?.unique} sparse=${!!after?.sparse}`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("✗ migration failed:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
