/**
 * READ-ONLY preflight: report whether an email already owns a store + how much data
 * would be wiped by a re-seed. Writes nothing. Run:
 *   node --env-file=.env.local --import tsx scripts/preflight-account.ts <email>
 */
import mongoose from "mongoose";

async function main() {
  const email = (process.argv[2] || "").trim().toLowerCase();
  if (!email) {
    console.error("usage: preflight-account.ts <email>");
    process.exit(1);
  }
  const db = await import("@/lib/db");
  await db.dbConnect();

  const user = await db.UserModel.findOne({ email }).lean<{ _id: unknown; name?: string } | null>();
  if (!user) {
    console.log(`NO_ACCOUNT: ${email} has no account yet — a fresh store would be created, nothing wiped.`);
  } else {
    const ownerId = String(user._id);
    const stores = await db.StoreModel.find({ ownerId }, { _id: 1, name: 1, subdomain: 1, status: 1 }).lean<
      { _id: unknown; name?: string; subdomain?: string; status?: string }[]
    >();
    const sids = stores.map((s) => String(s._id));
    const scoped = { storeId: { $in: sids } };
    const [products, orders, customers, collections, discounts] = await Promise.all([
      db.ProductModel.countDocuments(scoped),
      db.OrderModel.countDocuments(scoped),
      db.CustomerModel.countDocuments(scoped),
      db.CollectionModel.countDocuments(scoped),
      db.DiscountModel.countDocuments(scoped),
    ]);
    console.log(`EXISTING_ACCOUNT: ${email} (userId=${ownerId}, name=${user.name ?? "—"})`);
    console.log(`  stores: ${stores.map((s) => `@${s.subdomain ?? "?"} "${s.name ?? "?"}" [${s.status ?? "?"}]`).join(", ") || "none"}`);
    console.log(`  data → products:${products} orders:${orders} customers:${customers} collections:${collections} discounts:${discounts}`);
    console.log(`  A re-seed would DELETE all of the above for this owner.`);
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("preflight failed:", err instanceof Error ? err.message : err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
