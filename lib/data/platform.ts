import type { PlatformStoreSummary, StoreStatus, SubscriptionPlan } from "@/types";
import { mockPlatformStores } from "./mocks";
import { resolve } from "./_util";
import { isDbConfigured, dbConnect, StoreModel, UserModel, SubscriptionModel } from "@/lib/db";

/**
 * Platform-admin (internal) seams — NOT store-scoped by design; these intentionally
 * read across tenants (PRD §4.12 / §6.10). Real auth gating arrives with Stage 7/14.
 */
export async function getPlatformStores(): Promise<PlatformStoreSummary[]> {
  if (!isDbConfigured()) return resolve(mockPlatformStores);

  await dbConnect();
  const [stores, users, subs] = await Promise.all([
    StoreModel.find().sort({ createdAt: -1 }).lean(),
    UserModel.find().lean(),
    SubscriptionModel.find().lean(),
  ]);

  const ownerEmail = new Map(users.map((u) => [String(u._id), u.email]));
  const planByStore = new Map<string, SubscriptionPlan>(
    subs.map((s) => [String(s.storeId), s.plan as SubscriptionPlan]),
  );

  return stores.map((s) => ({
    name: s.name,
    owner: ownerEmail.get(String(s.ownerId)) ?? "—",
    subdomain: s.subdomain,
    status: s.status,
    plan: planByStore.get(String(s._id)) ?? "free",
    createdAt: new Date(s.createdAt as unknown as string).toISOString(),
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
