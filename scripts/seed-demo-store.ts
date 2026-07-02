/**
 * Seed a fully-built DEMO merchant the user can log into and inspect:
 * account (email+password) -> subdomain -> theme -> products -> collection ->
 * inventory -> discount -> settlement -> published. Re-runnable: it removes any
 * previous demo with the same email first.
 *
 * Run: node --env-file=.env.local --import tsx scripts/seed-demo-store.ts
 */
import mongoose from "mongoose";
import { randomBytes } from "node:crypto";

// Never commit a real/known password: take it from DEMO_PASSWORD, else mint a random
// one per run and print it (it's a throwaway local demo account, not a committed
// constant). A known, source-committed password would be a public backdoor if this
// seed ever ran against a shared/production DB.
const DEMO = {
  email: process.env.DEMO_EMAIL || "demo@davnoot.com",
  password: process.env.DEMO_PASSWORD || `demo-${randomBytes(9).toString("base64url")}`,
  name: "Davnoot Demo",
  subdomain: "davnoot-demo",
  storeName: "Davnoot Demo Store",
};

function loadEnv() {
  const loader = (process as unknown as { loadEnvFile?: (p: string) => void }).loadEnvFile;
  for (const file of [".env.local", ".env"]) {
    try { loader?.(file); } catch { /* absent */ }
  }
}
loadEnv();

// Refuse to seed a demo account against a production deployment.
if (process.env.NODE_ENV === "production") {
  console.error("Refusing to seed the demo store with NODE_ENV=production.");
  process.exit(1);
}

const IMG = (id: string) => `https://res.cloudinary.com/demo/image/upload/w_800,h_800,c_fill/${id}.jpg`;

async function main() {
  const db = await import("@/lib/db");
  const { provisionMerchantWithPassword } = await import("@/lib/auth/provision");
  const { createProduct } = await import("@/lib/data/products");
  const { createCollection } = await import("@/lib/data/collections");
  const { createDiscount } = await import("@/lib/data/discounts");
  const { updateStore, publishStore, getStore } = await import("@/lib/data/store");
  const { saveThemeConfig } = await import("@/lib/data/theme");
  const { buildTemplateConfig } = await import("@/lib/data/store-templates");
  await db.dbConnect();

  // --- Clean any prior demo so this is idempotent ---
  const prior = await db.UserModel.findOne({ email: DEMO.email }).lean<{ _id: string } | null>();
  if (prior) {
    const ownerId = String(prior._id);
    const stores = await db.StoreModel.find({ ownerId }, { _id: 1 }).lean<{ _id: string }[]>();
    const sids = stores.map((s) => String(s._id));
    const scoped = { storeId: { $in: sids } };
    await Promise.all([
      db.ProductModel.deleteMany(scoped), db.CollectionModel.deleteMany(scoped),
      db.InventoryAdjustmentModel.deleteMany(scoped), db.OrderModel.deleteMany(scoped),
      db.CustomerModel.deleteMany(scoped), db.CartModel.deleteMany(scoped),
      db.DiscountModel.deleteMany(scoped), db.ThemeConfigModel.deleteMany(scoped),
      db.SubscriptionModel.deleteMany({ ownerId }), db.StoreModel.deleteMany({ _id: { $in: sids } }),
      db.UserModel.deleteMany({ _id: ownerId }),
    ]);
    console.log("· removed previous demo account so this run is fresh");
  }

  // --- 1. Account (email + password) ---
  const id = await provisionMerchantWithPassword({ email: DEMO.email, password: DEMO.password, name: DEMO.name });
  const { storeId } = id;
  console.log(`✓ created merchant ${DEMO.email}  (userId=${id.userId})`);

  // --- 2. Claim subdomain (mirrors claimSubdomain) + 3. seed theme template ---
  await db.StoreModel.findByIdAndUpdate(storeId, { subdomain: DEMO.subdomain, name: DEMO.storeName });
  const tpl = buildTemplateConfig("cbd-wellness");
  if (tpl) await saveThemeConfig(storeId, tpl);
  console.log(`✓ claimed @${DEMO.subdomain} and seeded the cbd-wellness theme`);

  // --- 4. Products ---
  const products = [
    {
      title: "Full-Spectrum CBD Oil 1000mg", handle: "cbd-oil-1000mg", productType: "Tinctures", vendor: "Davnoot Labs",
      description: "<p>Organically grown, third-party lab tested full-spectrum hemp extract. 30ml.</p>",
      tags: ["bestseller", "tincture"], attributes: [{ name: "CBD", value: "1000mg" }, { name: "Type", value: "Full-Spectrum" }],
      images: [IMG("sample")],
      variants: [
        { id: "v-mint", title: "Mint", sku: "OIL-1000-MINT", price: 59.99, inventory: { quantity: 40, policy: "deny", lowStockThreshold: 5, trackInventory: true } },
        { id: "v-natural", title: "Natural", sku: "OIL-1000-NAT", price: 59.99, inventory: { quantity: 25, policy: "deny", lowStockThreshold: 5, trackInventory: true } },
      ],
      options: [{ name: "Flavor", values: ["Mint", "Natural"] }],
    },
    {
      title: "CBD Gummies — Mixed Berry", handle: "cbd-gummies-berry", productType: "Edibles", vendor: "Davnoot Labs",
      description: "<p>25mg CBD per gummy, 30 count. Vegan, gluten-free.</p>",
      tags: ["edibles", "vegan"], attributes: [{ name: "CBD", value: "25mg / piece" }, { name: "Count", value: "30" }],
      images: [IMG("sample")],
      variants: [{ id: "v-1", title: "30 ct", sku: "GUM-BERRY-30", price: 34.0, inventory: { quantity: 60, policy: "deny", lowStockThreshold: 8, trackInventory: true } }],
      options: [],
    },
    {
      title: "Calming CBD Balm 500mg", handle: "cbd-balm-500mg", productType: "Topicals", vendor: "Davnoot Labs",
      description: "<p>Targeted relief balm with menthol and arnica. 2oz.</p>",
      tags: ["topical"], attributes: [{ name: "CBD", value: "500mg" }],
      images: [IMG("sample")],
      variants: [{ id: "v-1", title: "2oz", sku: "BALM-500", price: 28.5, inventory: { quantity: 4, policy: "deny", lowStockThreshold: 5, trackInventory: true } }],
      options: [],
    },
    {
      title: "Sleep Softgels — CBN + CBD", handle: "sleep-softgels", productType: "Capsules", vendor: "Davnoot Labs",
      description: "<p>Nightly softgels blending CBN and CBD with melatonin. 30 count.</p>",
      tags: ["sleep", "new"], attributes: [{ name: "CBD", value: "15mg" }, { name: "CBN", value: "5mg" }],
      images: [IMG("sample")],
      variants: [{ id: "v-1", title: "30 ct", sku: "SLEEP-30", price: 44.99, inventory: { quantity: 30, policy: "deny", lowStockThreshold: 6, trackInventory: true } }],
      options: [],
    },
    {
      title: "Pet CBD Drops 250mg", handle: "pet-cbd-drops", productType: "Pet", vendor: "Davnoot Labs",
      description: "<p>Bacon-flavored CBD oil formulated for dogs and cats. 15ml.</p>",
      tags: ["pets"], attributes: [{ name: "CBD", value: "250mg" }],
      images: [IMG("sample")],
      variants: [{ id: "v-1", title: "15ml", sku: "PET-250", price: 32.0, inventory: { quantity: 0, policy: "deny", lowStockThreshold: 4, trackInventory: true } }],
      options: [],
    },
  ];

  const created: { id: string; handle: string }[] = [];
  for (const p of products) {
    const doc = await createProduct(storeId, {
      title: p.title, description: p.description, images: p.images, status: "active",
      handle: p.handle, productType: p.productType, vendor: p.vendor, tags: p.tags,
      attributes: p.attributes as any, seo: {}, options: p.options as any, variants: p.variants as any,
    });
    created.push({ id: doc._id, handle: p.handle });
  }
  // one draft, to show draft vs active
  await createProduct(storeId, {
    title: "Limited Reserve Tincture (coming soon)", description: "<p>Launching next month.</p>", images: [], status: "draft",
    handle: "limited-reserve", seo: {}, options: [], variants: [{ id: "v-1", title: "Default", sku: "LTD", price: 89, inventory: { quantity: 0, policy: "deny", lowStockThreshold: 1, trackInventory: true } }] as any,
  });
  console.log(`✓ added ${created.length} active products + 1 draft`);

  // --- 5. Collection ---
  await createCollection(storeId, { title: "Bestsellers", handle: "bestsellers", productIds: [created[0]!.id, created[1]!.id, created[3]!.id] });
  console.log("✓ created 'Bestsellers' collection");

  // --- 6. Discount ---
  await createDiscount(storeId, { code: "WELCOME15", type: "percentage", value: 15, minSubtotal: 30, status: "active" });
  console.log("✓ created discount WELCOME15 (15% off orders over $30)");

  // --- 7. Settlement + 8. Publish ---
  await updateStore(storeId, { settings: { settlement: { online: true, cod: true, inStore: false } } as any });
  await publishStore(storeId);
  const s = await getStore(storeId);
  console.log(`✓ enabled online + COD, published store (status=${s?.status})`);

  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || "ourapp.com";
  console.log("\n========================================================");
  console.log("  DEMO STORE READY");
  console.log("========================================================");
  console.log(`  Admin sign-in : http://localhost:3000/sign-in`);
  console.log(`     email      : ${DEMO.email}`);
  console.log(`     password   : ${DEMO.password}`);
  console.log(`  Storefront    : http://localhost:3000/s/${DEMO.subdomain}`);
  console.log(`  (production host would be ${DEMO.subdomain}.${appDomain})`);
  console.log(`  Promo code    : WELCOME15`);
  console.log("========================================================\n");

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("✗ seed-demo failed:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
