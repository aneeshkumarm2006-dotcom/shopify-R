import type { Store, SubscriptionPlan, User } from "@/types";
import { mockStore, mockUser } from "./mocks";
import { resolve } from "./_util";
import { getSubscription } from "./store";
import { linkAndListMemberStores } from "./staff";
import { storeCapForPlan } from "@/lib/payments/billing";
import {
  isDbConfigured,
  dbConnect,
  serializeOrNull,
  serializeMany,
  StoreModel,
  UserModel,
} from "@/lib/db";

/**
 * Account-level seams (multi-store ownership). A user owns N stores (`Store.ownerId`),
 * with `users.activeStoreId` marking the currently-selected one and `users.primaryStoreId`
 * anchoring the account's effective plan. These functions are the only place that maps a
 * user → their stores; the admin guard (`getMerchantContext`) and the store-switcher read
 * exclusively through here. Mock fallbacks keep Part A (single demo store) rendering.
 */

export async function getUserById(userId: string): Promise<User | null> {
  if (!isDbConfigured()) {
    return mockUser._id === userId ? resolve(mockUser) : null;
  }
  await dbConnect();
  return serializeOrNull<User>(await UserModel.findById(userId).lean());
}

/** Every store the user owns, oldest first (the primary store leads). */
export async function getStoresForOwner(ownerId: string): Promise<Store[]> {
  if (!isDbConfigured()) {
    return resolve(mockStore.ownerId === ownerId ? [mockStore] : []);
  }
  await dbConnect();
  return serializeMany<Store>(
    await StoreModel.find({ ownerId }).sort({ createdAt: 1 }).lean(),
  );
}

export async function getOwnedStoreCount(ownerId: string): Promise<number> {
  if (!isDbConfigured()) {
    return mockStore.ownerId === ownerId ? 1 : 0;
  }
  await dbConnect();
  return StoreModel.countDocuments({ ownerId });
}

/**
 * The account's effective plan — anchored to the PRIMARY store's subscription, so a
 * standard account keeps its multi-store entitlement regardless of any secondary
 * store's own (free) subscription. Falls back to `free` for any gap.
 */
export async function getAccountPlan(userId: string): Promise<SubscriptionPlan> {
  const user = await getUserById(userId);
  if (!user?.primaryStoreId) return "free";
  const sub = await getSubscription(user.primaryStoreId);
  return sub?.plan ?? "free";
}

export interface StoreCapStatus {
  plan: SubscriptionPlan;
  cap: number;
  count: number;
  /** True when the account has hit its plan's store limit — blocks `createStore`. */
  atCap: boolean;
}

/** Plan + cap + current owned-store count — the single object the UI and the create action read. */
export async function getStoreCapStatus(userId: string): Promise<StoreCapStatus> {
  const [plan, count] = await Promise.all([
    getAccountPlan(userId),
    getOwnedStoreCount(userId),
  ]);
  const cap = storeCapForPlan(plan);
  return { plan, cap, count, atCap: count >= cap };
}

/**
 * Resolve the user's active store, ownership-verified and self-healing.
 *
 * Reads `users.activeStoreId`, but only honors it when the user still owns that store
 * (the authorization gate — a stale or tampered active store can't surface another
 * tenant). On any miss it falls back to the user's first owned store and persists that
 * as the new active store. Returns `null` only when the user owns no store. DB-only —
 * callers handle stub mode (no auth → demo store) before reaching here.
 */
export async function resolveActiveStore(userId: string): Promise<Store | null> {
  await dbConnect();
  const user = await UserModel.findById(userId).lean<{ activeStoreId?: string; email?: string } | null>();
  if (!user) return null;

  // Stores the user can reach: owned (ownerId) OR an active membership (Phase 6 RBAC).
  const memberStoreIds = new Set(await linkAndListMemberStores(userId, user.email ?? ""));
  const accessible = (s: Store | null): s is Store =>
    Boolean(s) && (s!.ownerId === userId || memberStoreIds.has(s!._id));

  if (user.activeStoreId) {
    const active = serializeOrNull<Store>(await StoreModel.findById(user.activeStoreId).lean());
    if (accessible(active)) return active;
  }

  // Self-heal: dangling/foreign activeStoreId → first owned store, else first member store.
  const firstOwned = serializeOrNull<Store>(
    await StoreModel.findOne({ ownerId: userId }).sort({ createdAt: 1 }).lean(),
  );
  const fallback =
    firstOwned ??
    (memberStoreIds.size
      ? serializeOrNull<Store>(
          await StoreModel.findOne({ _id: { $in: [...memberStoreIds] } }).sort({ createdAt: 1 }).lean(),
        )
      : null);
  if (!fallback) return null;
  await UserModel.findByIdAndUpdate(userId, { activeStoreId: fallback._id });
  return fallback;
}

/** Every store a user can access — owned plus active memberships (Phase 6 switcher). */
export async function getAccessibleStores(userId: string): Promise<Store[]> {
  if (!isDbConfigured()) return resolve(mockStore.ownerId === userId ? [mockStore] : []);
  await dbConnect();
  const user = await UserModel.findById(userId).lean<{ email?: string } | null>();
  const memberStoreIds = await linkAndListMemberStores(userId, user?.email ?? "");
  const stores = serializeMany<Store>(
    await StoreModel.find({ $or: [{ ownerId: userId }, { _id: { $in: memberStoreIds } }] })
      .sort({ createdAt: 1 })
      .lean(),
  );
  return stores;
}

/**
 * Set the user's active store — IDOR-guarded: the write only happens when the user
 * actually owns the target store. Returns `true` on success, `false` when the store
 * isn't owned (or doesn't exist). The caller (a server action) is responsible for the
 * authenticated `userId`; this enforces the ownership half.
 */
export async function setActiveStore(userId: string, storeId: string): Promise<boolean> {
  if (!isDbConfigured()) return mockStore._id === storeId;
  await dbConnect();
  const store = serializeOrNull<Store>(await StoreModel.findById(storeId).lean());
  if (!store) return false;
  // Authorized when the user owns the store OR is an active member of it (Phase 6).
  if (store.ownerId !== userId) {
    const user = await UserModel.findById(userId).lean<{ email?: string } | null>();
    const memberStoreIds = await linkAndListMemberStores(userId, user?.email ?? "");
    if (!memberStoreIds.includes(storeId)) return false;
  }
  await UserModel.findByIdAndUpdate(userId, { activeStoreId: storeId });
  return true;
}
