/**
 * Dev seed (TODO Stage 6 — "port the mock fixtures into a dev store").
 *
 * Loads the Part-A mock fixtures (the "Northbound" demo tenant) into MongoDB so
 * the real data path renders exactly what Part A showed. Also creates minimal
 * records for the other platform demo stores, so the platform-admin list and
 * cross-tenant isolation are demonstrable against real data.
 *
 * Run:  npm run seed         (reads MONGODB_URI from .env.local / .env)
 *
 * Idempotent: each store's documents are cleared and re-inserted. Timestamps are
 * preserved from the fixtures (insertMany with `{ timestamps: false }`).
 */
import mongoose from "mongoose";
import type { PlatformStoreSummary, Store, Subscription, User } from "@/types";
import {
  dbConnect,
  StoreModel,
  UserModel,
  SubscriptionModel,
  ThemeConfigModel,
  ProductModel,
  CollectionModel,
  InventoryAdjustmentModel,
  OrderModel,
  CustomerModel,
  setOrderCounterFloor,
} from "@/lib/db";
import {
  MOCK_STORE_ID,
  mockStore,
  mockUser,
  mockSubscription,
  mockProducts,
  mockCollections,
  mockCustomers,
  mockOrders,
  mockInventoryAdjustments,
  mockPlatformStores,
  HOME_CONFIG,
} from "@/lib/data/mocks";

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

const insertOpts = { timestamps: false } as const;

async function seedPrimaryStore() {
  const sid = MOCK_STORE_ID;
  console.log(`→ seeding primary store "${mockStore.name}" (${sid})`);

  // Clear anything previously seeded for this tenant (idempotent re-run).
  await Promise.all([
    StoreModel.deleteOne({ _id: sid }),
    UserModel.deleteOne({ _id: mockUser._id }),
    SubscriptionModel.deleteMany({ storeId: sid }),
    ThemeConfigModel.deleteMany({ storeId: sid }),
    ProductModel.deleteMany({ storeId: sid }),
    CollectionModel.deleteMany({ storeId: sid }),
    InventoryAdjustmentModel.deleteMany({ storeId: sid }),
    OrderModel.deleteMany({ storeId: sid }),
    CustomerModel.deleteMany({ storeId: sid }),
  ]);

  // `create` (not `insertMany`) so `{ timestamps: false }` is honored and the
  // fixtures' historical dates survive — re-typed by Mongoose against each schema.
  await StoreModel.create([mockStore], insertOpts);
  await UserModel.create([mockUser], insertOpts);
  await SubscriptionModel.create([mockSubscription], insertOpts);
  await ThemeConfigModel.create([HOME_CONFIG], insertOpts);
  await ProductModel.create(mockProducts, insertOpts);
  await CollectionModel.create(mockCollections, insertOpts);
  await CustomerModel.create(mockCustomers, insertOpts);
  await OrderModel.create(mockOrders, insertOpts);
  await InventoryAdjustmentModel.create(mockInventoryAdjustments, insertOpts);

  // Align the atomic order counter so new orders continue AFTER the fixtures.
  const highestOrder = mockOrders.reduce((m, o) => Math.max(m, o.orderNumber), 1000);
  await setOrderCounterFloor(sid, highestOrder);

  console.log(
    `   ${mockProducts.length} products · ${mockCollections.length} collections · ` +
      `${mockCustomers.length} customers · ${mockOrders.length} orders · counter@${highestOrder}`,
  );
}

/** Minimal store/user/subscription for a platform demo tenant (no catalog). */
async function seedSecondaryStore(summary: PlatformStoreSummary) {
  const storeId = `store_${summary.subdomain}`;
  const ownerId = `user_${summary.subdomain}`;
  const now = new Date().toISOString();

  await Promise.all([
    StoreModel.deleteOne({ _id: storeId }),
    UserModel.deleteOne({ _id: ownerId }),
    SubscriptionModel.deleteMany({ storeId }),
  ]);

  const store: Store = {
    _id: storeId,
    ownerId,
    name: summary.name,
    subdomain: summary.subdomain,
    status: summary.status,
    ageGate: { enabled: true, minAge: 21, message: "You must be 21 or older to enter." },
    settings: { currency: "$", contactEmail: summary.owner },
    seoDefaults: { title: summary.name, description: "" },
    codeInjection: { headHtml: "", bodyHtml: "", customCss: "", customJs: "" },
    createdAt: summary.createdAt,
    updatedAt: now,
  };
  const user: User = {
    _id: ownerId,
    email: summary.owner,
    name: summary.name,
    googleId: `google-oauth2|${summary.subdomain}`,
    storeId,
    role: "merchant",
    createdAt: summary.createdAt,
    updatedAt: now,
  };
  const sub: Subscription = {
    _id: `sub_${summary.subdomain}`,
    ownerId,
    storeId,
    plan: summary.plan,
    status: "active",
    billingSeam: {},
    createdAt: summary.createdAt,
    updatedAt: now,
  };

  await StoreModel.create([store], insertOpts);
  await UserModel.create([user], insertOpts);
  await SubscriptionModel.create([sub], insertOpts);
  console.log(`→ seeded secondary store "${summary.name}" (${storeId}, ${summary.status})`);
}

async function main() {
  loadEnv();
  if (!process.env.MONGODB_URI) {
    console.error(
      "✗ MONGODB_URI is not set. Add it to site/.env.local (see .env.example) and re-run `npm run seed`.",
    );
    process.exit(1);
  }

  await dbConnect();
  await seedPrimaryStore();

  // The first platform summary IS Northbound (already fully seeded) — skip it.
  for (const summary of mockPlatformStores) {
    if (summary.subdomain === mockStore.subdomain) continue;
    await seedSecondaryStore(summary);
  }

  // Ensure declared indexes exist (unique subdomain/handle/email, storeId, …).
  await Promise.all([
    StoreModel.syncIndexes(),
    UserModel.syncIndexes(),
    ProductModel.syncIndexes(),
    CollectionModel.syncIndexes(),
    CustomerModel.syncIndexes(),
    OrderModel.syncIndexes(),
    InventoryAdjustmentModel.syncIndexes(),
    SubscriptionModel.syncIndexes(),
    ThemeConfigModel.syncIndexes(),
  ]);

  console.log("✓ seed complete");
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("✗ seed failed:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
