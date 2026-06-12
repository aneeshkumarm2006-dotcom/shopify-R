/**
 * DESTRUCTIVE operator helper: delete ALL stores owned by a user (+ all their
 * store-scoped data) and detach the user from any store. Use to turn a merchant
 * account into a clean platform-admin that owns no tenant stores.
 *
 * Usage:  tsx scripts/purge-owner-stores.ts <email>
 * Example: tsx scripts/purge-owner-stores.ts prem@davnoot.com
 *
 * This cannot be undone. It removes the user's stores, products, collections,
 * inventory, orders, customers, carts, discounts, theme configs, and subscriptions.
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
  const email = process.argv[2]?.toLowerCase();
  if (!email) {
    console.error("Usage: tsx scripts/purge-owner-stores.ts <email>");
    process.exit(1);
  }

  const {
    dbConnect,
    UserModel,
    StoreModel,
    ProductModel,
    CollectionModel,
    InventoryAdjustmentModel,
    OrderModel,
    CustomerModel,
    CartModel,
    DiscountModel,
    ThemeConfigModel,
    SubscriptionModel,
  } = await import("@/lib/db");

  await dbConnect();

  const user = await UserModel.findOne({ email }).lean<{ _id: string } | null>();
  if (!user) {
    console.error(`✗ no user with email "${email}".`);
    await mongoose.disconnect();
    process.exit(1);
  }
  const ownerId = String(user._id);

  const stores = await StoreModel.find({ ownerId }, { _id: 1, name: 1 }).lean<
    { _id: string; name: string }[]
  >();
  const storeIds = stores.map((s) => String(s._id));
  if (storeIds.length === 0) {
    console.log(`· ${email} owns no stores — nothing to purge.`);
    await mongoose.disconnect();
    process.exit(0);
  }
  console.log(`→ purging ${storeIds.length} store(s) for ${email}: ${stores.map((s) => s.name).join(", ")}`);

  const scoped = { storeId: { $in: storeIds } };
  const results = await Promise.all([
    ProductModel.deleteMany(scoped),
    CollectionModel.deleteMany(scoped),
    InventoryAdjustmentModel.deleteMany(scoped),
    OrderModel.deleteMany(scoped),
    CustomerModel.deleteMany(scoped),
    CartModel.deleteMany(scoped),
    DiscountModel.deleteMany(scoped),
    ThemeConfigModel.deleteMany(scoped),
    SubscriptionModel.deleteMany({ ownerId }),
    StoreModel.deleteMany({ _id: { $in: storeIds } }),
  ]);
  const deleted = results.reduce((sum, r) => sum + (r.deletedCount ?? 0), 0);

  await UserModel.updateOne(
    { _id: ownerId },
    { $unset: { activeStoreId: "", primaryStoreId: "" } },
  );

  console.log(`✓ deleted ${deleted} document(s) across ${storeIds.length} store(s); detached ${email}.`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("✗ purge failed:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
