import type { AgeGate, CodeInjection, SeoDefaults, Store, StoreSettings, Subscription, SubscriptionPlan, User } from "@/types";
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
  ProductModel,
  CollectionModel,
  PageModel,
  ReviewModel,
  InventoryAdjustmentModel,
  InventoryLevelModel,
  OrderModel,
  CustomerModel,
  CartModel,
  DiscountModel,
  GiftCardModel,
  CampaignModel,
  LocationModel,
  ThemeConfigModel,
  ThemeVersionModel,
  StoreMemberModel,
  CustomDomainModel,
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

/**
 * Suggest an available subdomain from a seed string (the store's default name). Reduces
 * onboarding friction: Shopify assigns a handle instantly rather than making you pick +
 * wait, so we prefill a pre-validated one the merchant can accept in one click or edit.
 * Slugifies the seed, then appends -2, -3, … until a free, DNS-safe, non-reserved value
 * is found. Returns "" only if nothing usable can be derived (caller falls back to the
 * blank field).
 */
export async function suggestAvailableSubdomain(seed: string): Promise<string> {
  const { RESERVED_SUBDOMAINS, isDnsSafeSubdomain } = await import("@/lib/tenant/host");
  const base = seed
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const root = base || "store";
  for (let i = 0; i < 100; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`.slice(0, 63);
    if (!isDnsSafeSubdomain(candidate) || RESERVED_SUBDOMAINS.includes(candidate)) continue;
    const taken = await getStoreBySubdomain(candidate);
    if (!taken) return candidate;
  }
  return "";
}

export async function getStoreOwner(storeId: string): Promise<User | null> {
  if (!isDbConfigured()) {
    return mockStore._id === storeId ? resolve(mockUser) : null;
  }
  // Under multi-store, owner resolves via `store.ownerId` (not a user→store back-ref:
  // a user owns many stores, so `findOne({ storeId })` no longer identifies the owner).
  await dbConnect();
  const store = await StoreModel.findById(storeId).lean<{ ownerId?: string } | null>();
  if (!store?.ownerId) return null;
  return serializeOrNull<User>(await UserModel.findById(store.ownerId).lean());
}

export async function getSubscription(storeId: string): Promise<Subscription | null> {
  if (!isDbConfigured()) {
    return mockSubscription.storeId === storeId ? resolve(mockSubscription) : null;
  }
  await dbConnect();
  return serializeOrNull<Subscription>(await SubscriptionModel.findOne({ storeId }).lean());
}

/**
 * Set a store's subscription plan. Billing is a stubbed seam in the MVP (no
 * processor), so the plan is changed directly here — this is what the Settings
 * billing card's clickable plan selector calls. The account's effective plan + store
 * cap read from the PRIMARY store's subscription (`getAccountPlan`), so changing the
 * plan on the primary store is what moves the multi-store entitlement.
 */
export async function setSubscriptionPlan(
  storeId: string,
  plan: SubscriptionPlan,
): Promise<Subscription | null> {
  if (!isDbConfigured()) {
    return mockSubscription.storeId === storeId ? resolve({ ...mockSubscription, plan }) : null;
  }
  await dbConnect();
  return serializeOrNull<Subscription>(
    await SubscriptionModel.findOneAndUpdate({ storeId }, { $set: { plan } }, { new: true }).lean(),
  );
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
    // Publishing now clears any pending scheduled publish (it's superseded).
    { $set: { status: "live", publishedAt: new Date(publishedAt), scheduledPublishAt: null } },
    { new: true },
  ).lean();
  if (!updated) throw new PublishError("Store not found.");
  return serialize<Store>(updated);
}

/**
 * Schedule (or cancel) an automatic publish (Phase 6). Pass an ISO time in the future
 * to schedule; pass null to cancel. Requires a claimed subdomain, same as publishing.
 * The cron sweep (`runScheduledPublishes`) does the actual publish when the time passes.
 */
export async function scheduleStorePublish(
  storeId: string,
  at: string | null,
): Promise<Store> {
  const store = await getStore(storeId);
  if (!store) throw new PublishError("Store not found.");
  if (at) {
    if (!store.subdomain) throw new PublishError("Claim a subdomain before scheduling.");
    if (store.status === "suspended") throw new PublishError("This store is suspended.");
    if (new Date(at).getTime() <= Date.now()) throw new PublishError("Pick a time in the future.");
  }
  if (!isDbConfigured()) return resolve({ ...store, scheduledPublishAt: at });
  await dbConnect();
  const updated = await StoreModel.findByIdAndUpdate(
    storeId,
    { $set: { scheduledPublishAt: at ? new Date(at) : null } },
    { new: true },
  ).lean();
  if (!updated) throw new PublishError("Store not found.");
  return serialize<Store>(updated);
}

/**
 * Cron sweep (Phase 6): publish every draft store whose `scheduledPublishAt` has passed.
 * Cross-tenant by design (one pass serves all stores); each publish goes through
 * `publishStore` (which re-checks the pre-flight + clears the schedule). Returns the
 * count published. Best-effort per store — one failure never aborts the batch.
 */
export async function runScheduledPublishes(): Promise<{ published: number; scanned: number }> {
  if (!isDbConfigured()) return { published: 0, scanned: 0 };
  await dbConnect();
  const due = await StoreModel.find({
    status: "draft",
    scheduledPublishAt: { $ne: null, $lte: new Date() },
  })
    .select("_id")
    .lean<{ _id: string }[]>();

  let published = 0;
  for (const { _id } of due) {
    try {
      await publishStore(_id);
      published++;
    } catch {
      // Skip stores that fail pre-flight (e.g. subdomain unclaimed); clear the stale schedule.
      await StoreModel.findByIdAndUpdate(_id, { $set: { scheduledPublishAt: null } }).catch(() => {});
    }
  }
  return { published, scanned: due.length };
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

/**
 * Permanently delete a store and every tenant-scoped record it owns — the whole
 * catalog (products, collections, pages, reviews, inventory), commerce data
 * (orders, customers, carts, discounts, gift cards, campaigns), configuration
 * (theme config + versions, locations, custom domains, subscription, members),
 * and finally the store document itself. Irreversible.
 *
 * Cross-tenant operator observability (PlatformEvent / PlatformError audit logs)
 * is deliberately left intact — it's append-only, PII-free, and keyed by storeId
 * for after-the-fact accountability. Authorization (owner-only, no impersonation)
 * is enforced by the calling server action, never here.
 */
export async function deleteStore(storeId: string): Promise<void> {
  if (!isDbConfigured()) return;
  await dbConnect();
  await Promise.all([
    ProductModel.deleteMany({ storeId }),
    CollectionModel.deleteMany({ storeId }),
    PageModel.deleteMany({ storeId }),
    ReviewModel.deleteMany({ storeId }),
    InventoryAdjustmentModel.deleteMany({ storeId }),
    InventoryLevelModel.deleteMany({ storeId }),
    OrderModel.deleteMany({ storeId }),
    CustomerModel.deleteMany({ storeId }),
    CartModel.deleteMany({ storeId }),
    DiscountModel.deleteMany({ storeId }),
    GiftCardModel.deleteMany({ storeId }),
    CampaignModel.deleteMany({ storeId }),
    LocationModel.deleteMany({ storeId }),
    ThemeConfigModel.deleteMany({ storeId }),
    ThemeVersionModel.deleteMany({ storeId }),
    StoreMemberModel.deleteMany({ storeId }),
    CustomDomainModel.deleteMany({ storeId }),
    SubscriptionModel.deleteMany({ storeId }),
  ]);
  await StoreModel.findByIdAndDelete(storeId);
}
