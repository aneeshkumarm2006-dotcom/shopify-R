/**
 * Verifies the Stage 6 acceptance criterion:
 *   "two stores produce independent, gap-free order numbers under concurrent inserts."
 *
 * Fires many `nextOrderNumber()` calls concurrently against two throwaway stores,
 * then asserts each store's allocated numbers form a contiguous 1..N set (gap-free,
 * no duplicates) and that the two stores ran independently.
 *
 * Run:  npm run db:check
 */
import mongoose from "mongoose";
import { dbConnect, nextOrderNumber, CounterModel } from "@/lib/db";

function loadEnv() {
  const loader = (process as unknown as { loadEnvFile?: (p: string) => void }).loadEnvFile;
  for (const file of [".env.local", ".env"]) {
    try {
      loader?.(file);
    } catch {
      /* ignore */
    }
  }
}

const STORE_A = "__counter_check_a";
const STORE_B = "__counter_check_b";
const N = 200;

function assertContiguous(label: string, nums: number[]) {
  const sorted = [...nums].sort((a, b) => a - b);
  const unique = new Set(nums);
  const gapFree = sorted.every((n, i) => n === i + 1);
  if (unique.size !== nums.length) {
    throw new Error(`${label}: duplicate order numbers issued (${nums.length - unique.size} dup).`);
  }
  if (!gapFree) {
    throw new Error(`${label}: sequence is not gap-free 1..${N} → [${sorted.slice(0, 5)}…]`);
  }
  console.log(`   ${label}: ${nums.length} numbers, contiguous 1..${sorted[sorted.length - 1]} ✓`);
}

async function main() {
  loadEnv();
  if (!process.env.MONGODB_URI) {
    console.error("✗ MONGODB_URI is not set. Add it to site/.env.local and re-run `npm run db:check`.");
    process.exit(1);
  }
  await dbConnect();

  // Fresh counters for the two throwaway stores.
  await CounterModel.deleteMany({ _id: { $in: [`order:${STORE_A}`, `order:${STORE_B}`] } });

  // Interleave 2N concurrent allocations across both stores.
  console.log(`→ firing ${N} concurrent allocations per store (${2 * N} total)…`);
  const tasks: Promise<{ store: string; n: number }>[] = [];
  for (let i = 0; i < N; i++) {
    tasks.push(nextOrderNumber(STORE_A).then((n) => ({ store: STORE_A, n })));
    tasks.push(nextOrderNumber(STORE_B).then((n) => ({ store: STORE_B, n })));
  }
  const results = await Promise.all(tasks);

  const a = results.filter((r) => r.store === STORE_A).map((r) => r.n);
  const b = results.filter((r) => r.store === STORE_B).map((r) => r.n);

  assertContiguous("store A", a);
  assertContiguous("store B", b);

  // Independence: each store ran its own 1..N regardless of the other.
  if (Math.max(...a) !== N || Math.max(...b) !== N) {
    throw new Error("stores are not independent — counters bled across tenants.");
  }
  console.log("   independence: each store ran its own 1..N, no cross-tenant bleed ✓");

  // Cleanup.
  await CounterModel.deleteMany({ _id: { $in: [`order:${STORE_A}`, `order:${STORE_B}`] } });
  console.log("✓ order-counter isolation check passed");
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("✗ check failed:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
