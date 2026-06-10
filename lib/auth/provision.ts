import mongoose from "mongoose";
import { dbConnect, StoreModel, UserModel, SubscriptionModel, ThemeConfigModel } from "@/lib/db";
import { emptyBillingSeam } from "@/lib/payments/billing";

/**
 * First-login provisioning (TODO Stage 7, PRD §7.1).
 *
 * The very first time a Google account signs in we materialise the three records
 * a merchant needs to exist on the platform:
 *   1. a `user`         — linked to the Google subject (single account = single store)
 *   2. an empty `store` — status `draft`, NO subdomain yet (claimed in onboarding)
 *   3. a `subscription` — `active`, default `free` plan (manually provisioned in MVP)
 *
 * It is idempotent: a returning user (matched by `googleId`, falling back to
 * `email`) is loaded, never duplicated, which is what enforces **one store per
 * account** at the provisioning seam (the unique `users.googleId` / `users.storeId`
 * indexes are the backstop).
 */

export interface ProvisionInput {
  googleId: string; // OAuth subject (profile.sub)
  email: string;
  name: string;
}

export interface MerchantIdentity {
  userId: string;
  storeId: string;
  role: "merchant" | "platform_admin";
}

/** Narrow shape we read back from the loosely-typed (`Model<any>`) user doc. */
interface UserLean {
  _id: string;
  storeId?: string;
  role?: "merchant" | "platform_admin";
}

function newId(): string {
  return new mongoose.Types.ObjectId().toHexString();
}

/** A friendly default store name derived from the merchant's name/email. */
function defaultStoreName(name: string, email: string): string {
  const base = (name || email.split("@")[0] || "My").trim();
  return `${base.split(/\s+/)[0]}'s store`;
}

export async function provisionMerchant(input: ProvisionInput): Promise<MerchantIdentity> {
  await dbConnect();

  // Returning user — match on the immutable OAuth subject first, then email
  // (covers an account whose googleId was seeded/imported before this login).
  const existing =
    (await UserModel.findOne({ googleId: input.googleId }).lean<UserLean | null>()) ??
    (await UserModel.findOne({ email: input.email.toLowerCase() }).lean<UserLean | null>());

  if (existing) {
    return {
      userId: String(existing._id),
      storeId: String(existing.storeId),
      role: existing.role ?? "merchant",
    };
  }

  // ---- First login: provision user → store → subscription, then link them. ----
  const userId = newId();
  const storeId = newId();

  // 1. user (no storeId yet — sparse unique index permits the gap)
  await UserModel.create({
    _id: userId,
    email: input.email.toLowerCase(),
    name: input.name,
    googleId: input.googleId,
    role: "merchant",
  });

  // 2. empty DRAFT store — subdomain intentionally unset until onboarding claims it.
  //    Seed type-complete sub-objects so admin screens render before configuration.
  await StoreModel.create({
    _id: storeId,
    ownerId: userId,
    name: defaultStoreName(input.name, input.email),
    status: "draft",
    ageGate: {
      enabled: true,
      minAge: 21,
      message:
        "You must be 21 or older to enter this store. Please verify your age to continue.",
    },
    settings: { currency: "$", contactEmail: input.email.toLowerCase(), socialLinks: [] },
    seoDefaults: { title: "", description: "" },
    codeInjection: { headHtml: "", bodyHtml: "", customCss: "", customJs: "" },
  });

  // 3. link store to user (1:1 ownership) + provision the subscription.
  await UserModel.findByIdAndUpdate(userId, { storeId });
  await SubscriptionModel.create({
    _id: newId(),
    ownerId: userId,
    storeId,
    plan: "free",
    status: "active",
    billingSeam: emptyBillingSeam(), // reserved seam, filled by a future processor
  });

  // 4. seed an empty ThemeConfig so /builder is immediately reachable without notFound().
  //    Onboarding may overwrite it with a starter template at claim time
  //    (`claimSubdomain` → `lib/data/store-templates`).
  const emptyTemplate = { sectionOrder: [], sections: {} };
  await ThemeConfigModel.create({
    _id: newId(),
    storeId,
    templates: {
      home: emptyTemplate,
      product: emptyTemplate,
      collection: emptyTemplate,
      page: emptyTemplate,
      cart: emptyTemplate,
    },
    header: { id: "header", type: "header", settings: {}, blockOrder: [], blocks: {} },
    footer: { id: "footer", type: "footer", settings: {}, blockOrder: [], blocks: {} },
  });

  return { userId, storeId, role: "merchant" };
}
