/**
 * NON-DESTRUCTIVE store builder: creates ONE new, fully-stocked store for an EXISTING
 * owner and publishes it. Deletes nothing — existing stores/products are untouched.
 *
 * Run:
 *   node --env-file=.env.local --import tsx scripts/seed-store-for-owner.ts <email> [subdomain] [storeName]
 */
import mongoose from "mongoose";

const IMG = (id: string) =>
  `https://res.cloudinary.com/demo/image/upload/w_900,h_1100,c_fill/${id}.jpg`;

async function pickSubdomain(
  db: typeof import("@/lib/db"),
  host: typeof import("@/lib/tenant/host"),
  desired: string,
): Promise<string> {
  const base = desired.trim().toLowerCase();
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    if (host.RESERVED_SUBDOMAINS.includes(candidate) || !host.isDnsSafeSubdomain(candidate)) continue;
    const taken = await db.StoreModel.findOne({ subdomain: candidate }).lean();
    if (!taken) return candidate;
  }
  throw new Error(`could not find a free subdomain near "${desired}"`);
}

async function main() {
  const email = (process.argv[2] || "").trim().toLowerCase();
  const desiredSub = (process.argv[3] || "davnoot-wellness").trim().toLowerCase();
  const storeName = process.argv[4] || "Davnoot Wellness";
  if (!email) {
    console.error("usage: seed-store-for-owner.ts <email> [subdomain] [storeName]");
    process.exit(1);
  }

  const db = await import("@/lib/db");
  const host = await import("@/lib/tenant/host");
  const { createStoreForUser } = await import("@/lib/auth/provision");
  const { createProduct } = await import("@/lib/data/products");
  const { createCollection } = await import("@/lib/data/collections");
  const { createDiscount } = await import("@/lib/data/discounts");
  const { updateStore, publishStore, getStore } = await import("@/lib/data/store");
  const { saveThemeConfig } = await import("@/lib/data/theme");
  const { buildTemplateConfig } = await import("@/lib/data/store-templates");
  await db.dbConnect();

  // --- 0. Resolve the EXISTING owner (never re-provision / never wipe) ---
  const user = await db.UserModel.findOne({ email }).lean<{ _id: unknown; name?: string } | null>();
  if (!user) throw new Error(`no account for ${email} — expected an existing owner`);
  const ownerId = String(user._id);
  console.log(`✓ owner ${email} (${user.name ?? "—"}, userId=${ownerId})`);

  // --- 1. New DRAFT store for this owner (existing stores untouched) ---
  const storeId = await createStoreForUser(ownerId, { name: storeName, contactEmail: email });
  const subdomain = await pickSubdomain(db, host, desiredSub);
  await db.StoreModel.findByIdAndUpdate(storeId, { subdomain, name: storeName });
  const tpl = buildTemplateConfig("cbd-wellness");
  if (tpl) await saveThemeConfig(storeId, tpl);
  console.log(`✓ created store "${storeName}" @${subdomain} + cbd-wellness theme (storeId=${storeId})`);

  // --- 2. Products (CBD / wellness) ---
  const products = [
    {
      title: "Full-Spectrum CBD Oil 1000mg", handle: "cbd-oil-1000mg", productType: "Tinctures", vendor: "Davnoot Labs",
      description: "<p>Organically grown, third-party lab tested full-spectrum hemp extract. 30ml.</p>",
      tags: ["bestseller", "tincture"], attributes: [{ name: "CBD", value: "1000mg" }, { name: "Type", value: "Full-Spectrum" }],
      images: [IMG("cld-sample-5")],
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
      images: [IMG("cld-sample-4")],
      variants: [{ id: "v-1", title: "30 ct", sku: "GUM-BERRY-30", price: 34.0, inventory: { quantity: 60, policy: "deny", lowStockThreshold: 8, trackInventory: true } }],
      options: [],
    },
    {
      title: "Calming CBD Balm 500mg", handle: "cbd-balm-500mg", productType: "Topicals", vendor: "Davnoot Labs",
      description: "<p>Targeted relief balm with menthol and arnica. 2oz.</p>",
      tags: ["topical"], attributes: [{ name: "CBD", value: "500mg" }],
      images: [IMG("cld-sample-3")],
      variants: [{ id: "v-1", title: "2oz", sku: "BALM-500", price: 28.5, inventory: { quantity: 18, policy: "deny", lowStockThreshold: 5, trackInventory: true } }],
      options: [],
    },
    {
      title: "Sleep Softgels — CBN + CBD", handle: "sleep-softgels", productType: "Capsules", vendor: "Davnoot Labs",
      description: "<p>Nightly softgels blending CBN and CBD with melatonin. 30 count.</p>",
      tags: ["sleep", "new"], attributes: [{ name: "CBD", value: "15mg" }, { name: "CBN", value: "5mg" }],
      images: [IMG("cld-sample-2")],
      variants: [{ id: "v-1", title: "30 ct", sku: "SLEEP-30", price: 44.99, inventory: { quantity: 30, policy: "deny", lowStockThreshold: 6, trackInventory: true } }],
      options: [],
    },
    {
      title: "Daytime Focus Capsules", handle: "focus-capsules", productType: "Capsules", vendor: "Davnoot Labs",
      description: "<p>Broad-spectrum CBD with L-theanine and B-vitamins for calm focus. 30 count.</p>",
      tags: ["focus", "bestseller"], attributes: [{ name: "CBD", value: "20mg" }],
      images: [IMG("cld-sample")],
      variants: [{ id: "v-1", title: "30 ct", sku: "FOCUS-30", price: 39.0, inventory: { quantity: 22, policy: "deny", lowStockThreshold: 5, trackInventory: true } }],
      options: [],
    },
    {
      title: "Pet CBD Drops 250mg", handle: "pet-cbd-drops", productType: "Pet", vendor: "Davnoot Labs",
      description: "<p>Bacon-flavored CBD oil formulated for dogs and cats. 15ml.</p>",
      tags: ["pets"], attributes: [{ name: "CBD", value: "250mg" }],
      images: [IMG("cld-sample-5")],
      variants: [{ id: "v-1", title: "15ml", sku: "PET-250", price: 32.0, inventory: { quantity: 12, policy: "deny", lowStockThreshold: 4, trackInventory: true } }],
      options: [],
    },
  ];

  const created: { id: string; handle: string }[] = [];
  for (const p of products) {
    const doc = await createProduct(storeId, {
      title: p.title, description: p.description, images: p.images, status: "active",
      handle: p.handle, productType: p.productType, vendor: p.vendor, tags: p.tags,
      attributes: p.attributes as never, seo: {}, options: p.options as never, variants: p.variants as never,
    });
    created.push({ id: doc._id, handle: p.handle });
  }
  // one draft product, to show draft vs active
  await createProduct(storeId, {
    title: "Limited Reserve Tincture (coming soon)", description: "<p>Launching next month.</p>", images: [], status: "draft",
    handle: "limited-reserve", seo: {}, options: [], variants: [{ id: "v-1", title: "Default", sku: "LTD", price: 89, inventory: { quantity: 0, policy: "deny", lowStockThreshold: 1, trackInventory: true } }] as never,
  });
  console.log(`✓ added ${created.length} active products + 1 draft`);

  // --- 3. Collection ---
  await createCollection(storeId, {
    title: "Bestsellers", handle: "bestsellers",
    productIds: [created[0]!.id, created[1]!.id, created[4]!.id],
  });
  console.log("✓ created 'Bestsellers' collection");

  // --- 4. Discount ---
  await createDiscount(storeId, { code: "WELCOME15", type: "percentage", value: 15, minSubtotal: 30, status: "active" });
  console.log("✓ created discount WELCOME15 (15% off orders over $30)");

  // --- 5. Settlement + publish ---
  await updateStore(storeId, { settings: { settlement: { online: true, cod: true, inStore: false } } as never });
  await publishStore(storeId);
  const s = await getStore(storeId);
  console.log(`✓ enabled online + COD, published (status=${s?.status})`);

  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || "ourapp.com";
  console.log("\n========================================================");
  console.log("  NEW STORE READY (existing stores untouched)");
  console.log("========================================================");
  console.log(`  Owner         : ${email}`);
  console.log(`  Store         : "${storeName}"  @${subdomain}  [${s?.status}]`);
  console.log(`  Storefront    : https://${subdomain}.${appDomain}`);
  console.log(`  Path fallback : http://localhost:3000/s/${subdomain}`);
  console.log(`  Promo code    : WELCOME15`);
  console.log(`  Note          : switch to it via the store switcher in the admin.`);
  console.log("========================================================\n");

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("✗ seed-store-for-owner failed:", err instanceof Error ? err.message : err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
