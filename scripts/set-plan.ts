/**
 * Operator helper: set a store's subscription plan (manual billing provisioning).
 *
 * Billing is a stubbed seam in the MVP (no processor), so plans are provisioned by
 * hand. This flips the subscription on the store with the given subdomain.
 *
 * Usage:  tsx scripts/set-plan.ts <subdomain> [free|standard]
 * Example: tsx scripts/set-plan.ts premsai standard
 *
 * The account's effective plan (and store cap) is read from the user's PRIMARY store's
 * subscription, so flip the plan on the merchant's primary store to change their cap.
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
  const subdomain = process.argv[2];
  const plan = (process.argv[3] ?? "standard").toLowerCase();
  if (!subdomain) {
    console.error("Usage: tsx scripts/set-plan.ts <subdomain> [free|standard]");
    process.exit(1);
  }
  if (plan !== "free" && plan !== "standard") {
    console.error(`Invalid plan "${plan}" — must be "free" or "standard".`);
    process.exit(1);
  }

  const { dbConnect, StoreModel, SubscriptionModel } = await import("@/lib/db");
  await dbConnect();

  const store = await StoreModel.findOne({ subdomain: subdomain.toLowerCase() }).lean<{ _id: string } | null>();
  if (!store) {
    console.error(`✗ no store with subdomain "${subdomain}".`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const res = await SubscriptionModel.updateOne(
    { storeId: String(store._id) },
    { $set: { plan } },
  );
  if (res.matchedCount === 0) {
    console.error(`✗ no subscription found for store "${subdomain}" (${store._id}).`);
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`✓ set "${subdomain}" (${store._id}) → plan "${plan}"`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("✗ set-plan failed:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
