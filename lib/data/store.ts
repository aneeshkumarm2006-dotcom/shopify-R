import type { AgeGate, CodeInjection, SeoDefaults, Store, StoreSettings, Subscription, User } from "@/types";
import { mockStore, mockSubscription, mockUser } from "./mocks";
import { resolve } from "./_util";
import {
  isDbConfigured,
  dbConnect,
  serialize,
  serializeOrNull,
  StoreModel,
  UserModel,
  SubscriptionModel,
} from "@/lib/db";

/**
 * Store / account seams. The `stores` collection is keyed by its own `_id`, so
 * `getStore(storeId)` is a primary-key read; owner + subscription resolve by
 * `storeId`. Signatures are unchanged from Stage 0 — only the bodies now hit
 * MongoDB when configured, with a mock fallback so Part A renders with no DB.
 */
export async function getStore(storeId: string): Promise<Store | null> {
  if (!isDbConfigured()) {
    return mockStore._id === storeId ? resolve(mockStore) : null;
  }
  await dbConnect();
  return serializeOrNull<Store>(await StoreModel.findById(storeId).lean());
}

export async function getStoreBySubdomain(subdomain: string): Promise<Store | null> {
  if (!isDbConfigured()) {
    return mockStore.subdomain === subdomain ? resolve(mockStore) : null;
  }
  await dbConnect();
  return serializeOrNull<Store>(
    await StoreModel.findOne({ subdomain: subdomain.toLowerCase() }).lean(),
  );
}

export async function getStoreOwner(storeId: string): Promise<User | null> {
  if (!isDbConfigured()) {
    return mockUser.storeId === storeId ? resolve(mockUser) : null;
  }
  await dbConnect();
  return serializeOrNull<User>(await UserModel.findOne({ storeId }).lean());
}

export async function getSubscription(storeId: string): Promise<Subscription | null> {
  if (!isDbConfigured()) {
    return mockSubscription.storeId === storeId ? resolve(mockSubscription) : null;
  }
  await dbConnect();
  return serializeOrNull<Subscription>(await SubscriptionModel.findOne({ storeId }).lean());
}

/** The store fields the Settings screen can edit (Stage 9 onward). */
export interface StoreUpdate {
  name?: string;
  settings?: Partial<StoreSettings>;
  seoDefaults?: Partial<SeoDefaults>;
  codeInjection?: Partial<CodeInjection>;
  ageGate?: Partial<AgeGate>;
}

/**
 * Persist Settings changes (Stage 9 wires the brand logo Cloudinary URL through
 * `settings.logoUrl`; the rest of the form rides along). Nested objects are
 * shallow-merged onto the current document so untouched sub-fields (e.g.
 * `settings.socialLinks`, `seoDefaults.ogImage`) survive. Code-injection content
 * is stored verbatim; its sanitization/rendering is owned by Stage 11/14.
 */
export async function updateStore(
  storeId: string,
  update: StoreUpdate,
): Promise<Store | null> {
  if (!isDbConfigured()) {
    return mockStore._id === storeId
      ? resolve({
          ...mockStore,
          ...(update.name !== undefined ? { name: update.name } : {}),
          settings: { ...mockStore.settings, ...update.settings },
          seoDefaults: { ...mockStore.seoDefaults, ...update.seoDefaults },
          codeInjection: { ...mockStore.codeInjection, ...update.codeInjection },
          ageGate: { ...mockStore.ageGate, ...update.ageGate },
        })
      : null;
  }

  await dbConnect();
  const current = await StoreModel.findById(storeId).lean();
  if (!current) return null;
  const merged = serialize<Store>(current);

  const $set: Record<string, unknown> = {};
  if (update.name !== undefined) $set.name = update.name;
  if (update.settings) $set.settings = { ...merged.settings, ...update.settings };
  if (update.seoDefaults) $set.seoDefaults = { ...merged.seoDefaults, ...update.seoDefaults };
  if (update.codeInjection)
    $set.codeInjection = { ...merged.codeInjection, ...update.codeInjection };
  if (update.ageGate) $set.ageGate = { ...merged.ageGate, ...update.ageGate };

  return serializeOrNull<Store>(
    await StoreModel.findByIdAndUpdate(storeId, { $set }, { new: true }).lean(),
  );
}

/** Why a publish attempt was rejected — surfaced to the merchant in the publish flow. */
export class PublishError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublishError";
  }
}

/**
 * Publish a store (Stage 11, PRD §6.10). Validates the one hard requirement — a
 * claimed subdomain — then flips `status: live` and stamps `publishedAt` the first
 * time. The single-config model (PRD §11) means there's no theme snapshot: going
 * live simply lets the subdomain serve the store's current saved `themeConfig`.
 * A suspended store can't be self-published (only the platform can lift suspension).
 */
export async function publishStore(storeId: string): Promise<Store> {
  const store = await getStore(storeId);
  if (!store) throw new PublishError("Store not found.");
  if (!store.subdomain) {
    throw new PublishError("Claim a subdomain before publishing.");
  }
  if (store.status === "suspended") {
    throw new PublishError("This store is suspended and can't be published.");
  }

  const publishedAt = store.publishedAt ?? new Date().toISOString();

  if (!isDbConfigured()) {
    return resolve({ ...store, status: "live", publishedAt });
  }
  await dbConnect();
  const updated = await StoreModel.findByIdAndUpdate(
    storeId,
    { $set: { status: "live", publishedAt: new Date(publishedAt) } },
    { new: true },
  ).lean();
  if (!updated) throw new PublishError("Store not found.");
  return serialize<Store>(updated);
}

/**
 * Unpublish a store (Stage 11, PRD §6.10) — reverts to `draft` so its subdomain
 * stops serving (the storefront layer only serves `live`). `publishedAt` is kept as
 * a record of the first publish. A suspended store stays suspended (platform-only).
 */
export async function unpublishStore(storeId: string): Promise<Store> {
  const store = await getStore(storeId);
  if (!store) throw new PublishError("Store not found.");
  if (store.status === "suspended") {
    throw new PublishError("This store is suspended.");
  }

  if (!isDbConfigured()) {
    return resolve({ ...store, status: "draft" });
  }
  await dbConnect();
  const updated = await StoreModel.findByIdAndUpdate(
    storeId,
    { $set: { status: "draft" } },
    { new: true },
  ).lean();
  if (!updated) throw new PublishError("Store not found.");
  return serialize<Store>(updated);
}
