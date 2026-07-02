import mongoose from "mongoose";
import { dbConnect, StoreModel, UserModel, SubscriptionModel, ThemeConfigModel } from "@/lib/db";
import { emptyBillingSeam } from "@/lib/payments/billing";
import { recordEvent } from "@/lib/data";
import { hashPassword, verifyPassword, dummyVerify } from "./password";

/** Thrown by `provisionMerchantWithPassword` when the email already has an account. */
export class EmailTakenError extends Error {
  constructor() {
    super("An account with that email already exists.");
    this.name = "EmailTakenError";
  }
}

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
  name?: string;
  email?: string;
  activeStoreId?: string;
  passwordHash?: string;
  role?: "merchant" | "platform_admin";
}

/** A resolved credential login — merchant identity plus the display fields the session needs. */
export interface CredentialIdentity extends MerchantIdentity {
  name: string;
  email: string;
}

function newId(): string {
  return new mongoose.Types.ObjectId().toHexString();
}

/** A friendly default store name derived from the merchant's name/email. */
function defaultStoreName(name: string, email: string): string {
  const base = (name || email.split("@")[0] || "My").trim();
  return `${base.split(/\s+/)[0]}'s store`;
}

/**
 * Create one store (+ its empty ThemeConfig + a free subscription) owned by `userId`,
 * returning the new storeId. This is the single unit of "a store now exists on the
 * platform", shared by first-login provisioning (the primary store) and the multi-store
 * `createStore` action (additional stores). It deliberately does NOT touch the user's
 * `activeStoreId` / `primaryStoreId` pointers — the caller owns that decision.
 */
export async function createStoreForUser(
  userId: string,
  input: { name: string; contactEmail: string },
): Promise<string> {
  await dbConnect();
  const storeId = newId();

  // Empty DRAFT store — subdomain intentionally unset until onboarding claims it.
  // Seed type-complete sub-objects so admin screens render before configuration.
  await StoreModel.create({
    _id: storeId,
    ownerId: userId,
    name: input.name,
    status: "draft",
    ageGate: {
      enabled: true,
      minAge: 21,
      message:
        "You must be 21 or older to enter this store. Please verify your age to continue.",
    },
    settings: { currency: "$", contactEmail: input.contactEmail, socialLinks: [] },
    seoDefaults: { title: "", description: "" },
    codeInjection: { headHtml: "", bodyHtml: "", customCss: "", customJs: "" },
  });

  // Each store carries its own (free, manually-provisioned) subscription.
  await SubscriptionModel.create({
    _id: newId(),
    ownerId: userId,
    storeId,
    plan: "free",
    status: "active",
    billingSeam: emptyBillingSeam(),
  });

  // Empty ThemeConfig so /builder is immediately reachable without notFound().
  // Onboarding may overwrite it with a starter template at claim time.
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

  return storeId;
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
      storeId: String(existing.activeStoreId),
      role: existing.role ?? "merchant",
    };
  }

  // ---- First login: provision the user, then their PRIMARY store. ----
  const userId = newId();

  // 1. user (no store pointers yet — sparse fields permit the gap until step 3)
  await UserModel.create({
    _id: userId,
    email: input.email.toLowerCase(),
    name: input.name,
    googleId: input.googleId,
    role: "merchant",
  });

  // 2. the primary store (+ its subscription + empty theme), via the shared unit.
  const storeId = await createStoreForUser(userId, {
    name: defaultStoreName(input.name, input.email),
    contactEmail: input.email.toLowerCase(),
  });

  // 3. point the user at it as BOTH active (current selection) and primary (the
  //    anchor for the account's effective plan).
  await UserModel.findByIdAndUpdate(userId, {
    activeStoreId: storeId,
    primaryStoreId: storeId,
  });

  // First-login audit trail (system actor — this runs inside the auth callback,
  // which may lack request scope; recordEvent degrades gracefully).
  await recordEvent({
    type: "account.first_provision",
    storeId,
    actorUserId: userId,
    actorType: "system",
    target: { kind: "user", id: userId },
  });
  await recordEvent({
    type: "store.created",
    storeId,
    actorUserId: userId,
    actorType: "system",
    target: { kind: "store", id: storeId },
  });

  return { userId, storeId, role: "merchant" };
}

/* ============================================================
   Email + password (credentials) — sign-up and sign-in.
   ============================================================ */

export interface PasswordSignupInput {
  email: string;
  name: string;
  password: string;
}

/**
 * Sign-up counterpart to `provisionMerchant`: create a brand-new merchant from an
 * email + password (their primary draft store + free subscription + empty theme,
 * via the same `createStoreForUser` unit as OAuth first-login). The password is
 * stored only as a scrypt hash, never in plaintext. Throws `EmailTakenError` if
 * the email already has an account (OAuth or credential) so the caller can surface
 * a friendly conflict instead of a 500.
 */
export async function provisionMerchantWithPassword(
  input: PasswordSignupInput,
): Promise<MerchantIdentity> {
  await dbConnect();
  const email = input.email.toLowerCase();

  // One account per email — covers both an existing Google user and a prior signup.
  const existing = await UserModel.findOne({ email }).lean<UserLean | null>();
  if (existing) throw new EmailTakenError();

  const userId = newId();
  const passwordHash = await hashPassword(input.password);

  // 1. user (no store pointers yet — set in step 3, mirroring OAuth provisioning).
  await UserModel.create({
    _id: userId,
    email,
    name: input.name,
    passwordHash,
    role: "merchant",
  });

  // 2. the primary store (+ its subscription + empty theme), via the shared unit.
  const storeId = await createStoreForUser(userId, {
    name: defaultStoreName(input.name, email),
    contactEmail: email,
  });

  // 3. point the user at it as both active and primary.
  await UserModel.findByIdAndUpdate(userId, {
    activeStoreId: storeId,
    primaryStoreId: storeId,
  });

  await recordEvent({
    type: "account.first_provision",
    storeId,
    actorUserId: userId,
    actorType: "system",
    target: { kind: "user", id: userId },
  });
  await recordEvent({
    type: "store.created",
    storeId,
    actorUserId: userId,
    actorType: "system",
    target: { kind: "store", id: storeId },
  });

  return { userId, storeId, role: "merchant" };
}

/**
 * Verify an email + password against the stored scrypt hash, returning the
 * merchant identity for the NextAuth Credentials `authorize` callback (or `null`
 * on any failure — unknown email, OAuth-only account with no password, or a bad
 * password). Deliberately gives no hint which check failed.
 */
export async function authenticateCredentials(
  email: string,
  password: string,
): Promise<CredentialIdentity | null> {
  await dbConnect();
  const user = await UserModel.findOne({ email: email.toLowerCase() }).lean<UserLean | null>();
  if (!user?.passwordHash || !user.activeStoreId) {
    await dummyVerify(password); // equalize timing so absent accounts aren't distinguishable
    return null;
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;

  return {
    userId: String(user._id),
    storeId: String(user.activeStoreId),
    role: user.role ?? "merchant",
    name: user.name ?? email,
    email: user.email ?? email,
  };
}
