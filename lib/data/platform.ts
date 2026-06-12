import type {
  HealthCheckResult,
  PlatformKpis,
  PlatformStoreSummary,
  PlatformUserSummary,
  Store,
  StoreOperatorDetail,
  StoreStatus,
  SubscriptionPlan,
} from "@/types";
import { mockPlatformStores } from "./mocks";
import { resolve } from "./_util";
import { runHealthChecks, failingHealthChecks } from "./health";
import {
  isDbConfigured,
  dbConnect,
  serialize,
  serializeOrNull,
  StoreModel,
  UserModel,
  SubscriptionModel,
  ProductModel,
  OrderModel,
  CustomerModel,
} from "@/lib/db";

const DAY_MS = 1000 * 60 * 60 * 24;
const daysSince = (iso: unknown): number =>
  Math.floor((Date.now() - new Date(iso as string).getTime()) / DAY_MS);

/** Active-product counts per store (one aggregation, for health + summaries). */
async function activeProductCounts(): Promise<Map<string, number>> {
  const rows = await ProductModel.aggregate([
    { $match: { status: "active" } },
    { $group: { _id: "$storeId", count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r: { _id: unknown; count: number }) => [String(r._id), r.count]));
}

/** Number of failing alignment checks for a raw store doc. */
function healthFlagCount(storeDoc: unknown, productCount: number): number {
  const store = serialize<Store>(storeDoc);
  return failingHealthChecks({
    store,
    productCount,
    daysSinceCreated: daysSince(store.createdAt),
  }).length;
}

/**
 * Platform-admin (internal) seams — NOT store-scoped by design; these intentionally
 * read across tenants (PRD §4.12 / §6.10), so they must only ever be reached behind
 * `requirePlatformAdmin`.
 */
export async function getPlatformStores(): Promise<PlatformStoreSummary[]> {
  if (!isDbConfigured()) return resolve(mockPlatformStores);

  await dbConnect();
  const [stores, users, subs, productCounts] = await Promise.all([
    StoreModel.find().sort({ createdAt: -1 }).lean(),
    UserModel.find().lean(),
    SubscriptionModel.find().lean(),
    activeProductCounts(),
  ]);

  const ownerEmail = new Map(users.map((u) => [String(u._id), u.email]));
  const planByStore = new Map<string, SubscriptionPlan>(
    subs.map((s) => [String(s.storeId), s.plan as SubscriptionPlan]),
  );

  return stores.map((s) => ({
    id: String(s._id),
    name: s.name,
    owner: ownerEmail.get(String(s.ownerId)) ?? "—",
    subdomain: s.subdomain,
    status: s.status,
    plan: planByStore.get(String(s._id)) ?? "free",
    createdAt: new Date(s.createdAt as unknown as string).toISOString(),
    healthFlags: healthFlagCount(s, productCounts.get(String(s._id)) ?? 0),
  }));
}

/** Operator store-detail: config snapshot + owner + plan + counts + health. */
export async function getStoreOperatorDetail(
  storeId: string,
): Promise<StoreOperatorDetail | null> {
  if (!isDbConfigured()) return null;
  await dbConnect();
  const store = serializeOrNull<Store>(await StoreModel.findById(storeId).lean());
  if (!store) return null;

  const [owner, sub, productCount, orderCount, customerCount] = await Promise.all([
    UserModel.findById(store.ownerId).lean<{ email?: string } | null>(),
    SubscriptionModel.findOne({ storeId }).lean<{ plan?: SubscriptionPlan } | null>(),
    ProductModel.countDocuments({ storeId, status: "active" }),
    OrderModel.countDocuments({ storeId }),
    CustomerModel.countDocuments({ storeId }),
  ]);

  const health = runHealthChecks({
    store,
    productCount,
    daysSinceCreated: daysSince(store.createdAt),
  });

  return {
    store,
    ownerEmail: owner?.email ?? "—",
    plan: sub?.plan ?? "free",
    productCount,
    orderCount,
    customerCount,
    health,
  };
}

export type MisalignedStore = Pick<
  PlatformStoreSummary,
  "id" | "name" | "subdomain" | "status"
> & { failing: HealthCheckResult[] };

/** Stores failing one or more alignment checks (the operator Health screen). */
export async function getMisalignedStores(): Promise<MisalignedStore[]> {
  if (!isDbConfigured()) return resolve([]);
  await dbConnect();
  const [stores, productCounts] = await Promise.all([
    StoreModel.find().sort({ createdAt: -1 }).lean(),
    activeProductCounts(),
  ]);

  const out: MisalignedStore[] = [];
  for (const s of stores) {
    const store = serialize<Store>(s);
    const failing = failingHealthChecks({
      store,
      productCount: productCounts.get(store._id) ?? 0,
      daysSinceCreated: daysSince(store.createdAt),
    });
    if (failing.length > 0) {
      out.push({ id: store._id, name: store.name, subdomain: store.subdomain, status: store.status, failing });
    }
  }
  return out;
}

/** Platform KPIs for the operator overview. */
export async function getPlatformKpis(): Promise<PlatformKpis> {
  if (!isDbConfigured()) {
    return {
      totalStores: 0, liveStores: 0, draftStores: 0, suspendedStores: 0,
      freePlan: 0, standardPlan: 0, newStores7d: 0, newStores30d: 0,
      totalMerchants: 0, totalOrders: 0, gmvPaid: 0,
    };
  }
  await dbConnect();
  const now = Date.now();
  const [stores, subs, totalMerchants, totalOrders, paidAgg] = await Promise.all([
    StoreModel.find({}, { status: 1, createdAt: 1 }).lean(),
    SubscriptionModel.find({}, { plan: 1 }).lean(),
    UserModel.countDocuments({}),
    OrderModel.countDocuments({}),
    OrderModel.aggregate([
      { $match: { paymentStatus: "paid" } },
      { $group: { _id: null, sum: { $sum: "$total" } } },
    ]),
  ]);

  const byStatus = (st: StoreStatus) => stores.filter((s) => s.status === st).length;
  const since = (days: number) =>
    stores.filter((s) => now - new Date(s.createdAt as string).getTime() <= days * DAY_MS).length;

  return {
    totalStores: stores.length,
    liveStores: byStatus("live"),
    draftStores: byStatus("draft"),
    suspendedStores: byStatus("suspended"),
    freePlan: subs.filter((s) => s.plan === "free").length,
    standardPlan: subs.filter((s) => s.plan === "standard").length,
    newStores7d: since(7),
    newStores30d: since(30),
    totalMerchants,
    totalOrders,
    gmvPaid: (paidAgg[0] as { sum?: number } | undefined)?.sum ?? 0,
  };
}

/** Operator user/account list — merchants with store counts + effective plan. */
export async function getPlatformUsers(): Promise<PlatformUserSummary[]> {
  if (!isDbConfigured()) return resolve([]);
  await dbConnect();
  const [users, stores, subs] = await Promise.all([
    UserModel.find().sort({ createdAt: -1 }).lean(),
    StoreModel.find({}, { ownerId: 1 }).lean(),
    SubscriptionModel.find({}, { storeId: 1, plan: 1 }).lean(),
  ]);

  const storeCount = new Map<string, number>();
  for (const s of stores) {
    const k = String(s.ownerId);
    storeCount.set(k, (storeCount.get(k) ?? 0) + 1);
  }
  const planByStore = new Map<string, SubscriptionPlan>(
    subs.map((s) => [String(s.storeId), s.plan as SubscriptionPlan]),
  );

  return users.map((u) => ({
    id: String(u._id),
    email: u.email,
    name: u.name,
    role: (u.role as "merchant" | "platform_admin") ?? "merchant",
    storeCount: storeCount.get(String(u._id)) ?? 0,
    plan: planByStore.get(String(u.primaryStoreId ?? u.activeStoreId)) ?? "free",
  }));
}

/**
 * Platform operator action: set a store's lifecycle `status` by subdomain
 * (Stage 14 — "`status: suspended` takes a store offline (platform admin)"). This
 * is deliberately CROSS-TENANT (not store-scoped) — it's the one place the platform
 * reaches into any tenant — so it must only ever be reached behind
 * `requirePlatformAdmin`. Suspending flips `status: suspended`, which the storefront
 * resolver (`resolveStorefront`) already refuses to serve, taking the store offline
 * immediately; reinstating returns it to `live`. Returns the new status, or `null`
 * when the subdomain matches no store.
 */
export async function setStoreStatusBySubdomain(
  subdomain: string,
  status: StoreStatus,
): Promise<StoreStatus | null> {
  if (!isDbConfigured()) {
    const found = mockPlatformStores.find((s) => s.subdomain === subdomain);
    return found ? resolve(status) : null;
  }
  await dbConnect();
  const updated = await StoreModel.findOneAndUpdate(
    { subdomain: subdomain.toLowerCase() },
    { $set: { status } },
    { new: true },
  ).lean();
  return updated ? status : null;
}

// Re-export the client-safe subdomain helpers so existing `@/lib/data` imports
// keep working. (The values themselves live in a Mongoose-free module so the
// onboarding Client Component can import them without pulling in the DB layer.)
export {
  checkSubdomain,
  isDnsSafeSubdomain,
  RESERVED_SUBDOMAINS,
  type SubdomainCheck,
} from "./subdomain";
