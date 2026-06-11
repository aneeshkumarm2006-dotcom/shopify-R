import type { Store, SubscriptionPlan, User } from "@/types";
import { mockStore, mockUser } from "./mocks";
import { resolve } from "./_util";
import { getSubscription } from "./store";
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
  const user = await UserModel.findById(userId).lean<{ activeStoreId?: string } | null>();
  if (!user) return null;

  if (user.activeStoreId) {
    const active = serializeOrNull<Store>(await StoreModel.findById(user.activeStoreId).lean());
    if (active && active.ownerId === userId) return active;
  }

  // Self-heal: dangling/foreign activeStoreId → first owned store, and persist it.
  const first = serializeOrNull<Store>(
    await StoreModel.findOne({ ownerId: userId }).sort({ createdAt: 1 }).lean(),
  );
  if (!first) return null;
  await UserModel.findByIdAndUpdate(userId, { activeStoreId: first._id });
  return first;
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
  if (!store || store.ownerId !== userId) return false;
  await UserModel.findByIdAndUpdate(userId, { activeStoreId: storeId });
  return true;
}
