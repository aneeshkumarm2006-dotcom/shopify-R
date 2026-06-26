"use server";

import { revalidatePath } from "next/cache";
import type { SubscriptionPlan } from "@/types";
import { isDbConfigured, dbConnect, StoreModel } from "@/lib/db";
import {
  getStoreCapStatus,
  setActiveStore as setActiveStoreForUser,
} from "@/lib/data/account";
import { AuthError } from "next-auth";
import {
  createStoreForUser,
  provisionMerchantWithPassword,
  EmailTakenError,
} from "./provision";
import {
  checkSubdomain,
  isDnsSafeSubdomain,
  RESERVED_SUBDOMAINS,
  type SubdomainCheck,
} from "@/lib/data/subdomain";
import {
  buildTemplateConfig,
  isStoreTemplateId,
  type StoreTemplateId,
} from "@/lib/data/store-templates";
import { saveThemeConfig } from "@/lib/data/theme";
import { recordEvent } from "@/lib/data";
import { auth, signIn, signOut, isAuthConfigured, getMerchantContext, getActorUserId, assertNotImpersonating } from "./index";

/**
 * Server actions backing the auth UI (sign-in, onboarding, sign-out). Each one
 * works in BOTH modes: with auth configured it drives NextAuth + MongoDB; without
 * it, it reproduces the Part-A stub behaviour so the screens still flow on mock
 * data. The client never has to know which mode it is in.
 */

/** Sign-in button → start Google OAuth, or (stub) go straight to onboarding. */
export async function signInGoogle(): Promise<void> {
  if (!isAuthConfigured()) {
    const { redirect } = await import("next/navigation");
    redirect("/onboarding");
  }
  // Land on the dashboard; the (admin) guard bounces brand-new merchants (no
  // subdomain yet) onward to /onboarding.
  await signIn("google", { redirectTo: "/dashboard" });
}

/* ============================================================
   Email + password (credentials) sign-in / sign-up.
   These are `useActionState` actions: (prevState, formData) → result.
   ============================================================ */

export interface CredentialActionState {
  error?: string;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Sign in with email + password. Stub mode (no auth) routes to onboarding like the Google button. */
export async function signInCredentials(
  _prev: CredentialActionState,
  formData: FormData,
): Promise<CredentialActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };

  if (!isAuthConfigured()) {
    const { redirect } = await import("next/navigation");
    redirect("/onboarding"); // Part A demo flow
  }
  if (!isDbConfigured()) {
    return { error: "Email sign-in isn’t available — use Continue with Google." };
  }

  try {
    await signIn("credentials", { email, password, redirectTo: "/dashboard" });
  } catch (error) {
    // A bad password makes NextAuth throw an AuthError; success throws a Next.js
    // redirect, which must propagate untouched.
    if (error instanceof AuthError) return { error: "Incorrect email or password." };
    throw error;
  }
  return {};
}

/** Create an account with email + password, then sign in. Stub mode routes to onboarding. */
export async function signUpCredentials(
  _prev: CredentialActionState,
  formData: FormData,
): Promise<CredentialActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();

  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address." };
  if (password.length < 8) return { error: "Use a password of at least 8 characters." };

  if (!isAuthConfigured()) {
    const { redirect } = await import("next/navigation");
    redirect("/onboarding"); // Part A demo flow
  }
  if (!isDbConfigured()) {
    return { error: "Account creation isn’t available — use Continue with Google." };
  }

  try {
    await provisionMerchantWithPassword({
      email,
      password,
      name: name || email.split("@")[0] || "Merchant",
    });
  } catch (error) {
    if (error instanceof EmailTakenError) {
      return { error: "An account with that email already exists — sign in instead." };
    }
    // A duplicate-key error (E11000) here means a unique index collided — most
    // commonly a concurrent signup on the same email, or a misconfigured index.
    // Surface a friendly message instead of crashing the signup with a 500.
    if (typeof error === "object" && error !== null && (error as { code?: number }).code === 11000) {
      return { error: "We couldn’t create your account just now — please try again." };
    }
    throw error;
  }

  // Brand-new merchant has no subdomain yet → land them in onboarding to claim one.
  try {
    await signIn("credentials", { email, password, redirectTo: "/onboarding" });
  } catch (error) {
    if (error instanceof AuthError) return { error: "Account created — please sign in." };
    throw error;
  }
  return {};
}

/** Account menu → end the session (or, stubbed, just return to sign-in). */
export async function doSignOut(): Promise<void> {
  if (!isAuthConfigured()) {
    const { redirect } = await import("next/navigation");
    redirect("/sign-in");
  }
  // Clear any impersonation cookie so it can't outlive the session.
  const { clearImpersonation } = await import("./impersonation");
  await clearImpersonation();
  await signOut({ redirectTo: "/sign-in" });
}

/**
 * Live availability check for the onboarding field: format + reserved-word rules
 * always, then real DB uniqueness (excluding the caller's own store) when
 * configured, or the mock uniqueness list otherwise. Mirrors `SubdomainCheck`.
 */
export async function checkSubdomainAvailability(raw: string): Promise<SubdomainCheck> {
  const value = raw.trim().toLowerCase();
  if (!isDnsSafeSubdomain(value)) return { available: false, reason: "invalid" };
  if (RESERVED_SUBDOMAINS.includes(value)) return { available: false, reason: "reserved" };

  if (!isDbConfigured()) {
    return checkSubdomain(value); // mock uniqueness (Part A)
  }

  await dbConnect();
  // Exclude the caller's OWN active store from the clash check (re-claiming the same
  // address is fine). The active store is ownership-verified inside getMerchantContext.
  const ctx = await getMerchantContext();
  const ownStoreId = ctx?.storeId;
  const clash = await StoreModel.findOne({
    subdomain: value,
    ...(ownStoreId ? { _id: { $ne: ownStoreId } } : {}),
  }).lean();
  return clash ? { available: false, reason: "taken" } : { available: true };
}

export interface ClaimResult {
  ok: boolean;
  reason?: NonNullable<SubdomainCheck["reason"]>;
}

/**
 * Persist the claimed subdomain to the signed-in merchant's store (PRD §7.1),
 * then seed the store's themeConfig from the chosen starter template. Both
 * inputs are re-validated server-side (never trust the client); the subdomain
 * write catches the unique-index race so a near-simultaneous claim surfaces as
 * `taken` rather than a 500. In stub mode it no-ops and reports success so the
 * demo flow continues.
 */
export async function claimSubdomain(
  raw: string,
  templateId: StoreTemplateId = "blank",
): Promise<ClaimResult> {
  const value = raw.trim().toLowerCase();
  if (!isDnsSafeSubdomain(value)) return { ok: false, reason: "invalid" };
  if (RESERVED_SUBDOMAINS.includes(value)) return { ok: false, reason: "reserved" };

  if (!isAuthConfigured()) return { ok: true }; // Part A: nothing to persist

  // Claim onto the merchant's ACTIVE store (ownership-verified by getMerchantContext) —
  // for a multi-store user mid-onboarding, that's the store they just created.
  const ctx = await getMerchantContext();
  const storeId = ctx?.storeId;
  if (!storeId) return { ok: false, reason: "invalid" }; // not signed in

  try { await assertNotImpersonating(); } catch { return { ok: false, reason: "invalid" }; }

  await dbConnect();
  const clash = await StoreModel.findOne({ subdomain: value, _id: { $ne: storeId } }).lean();
  if (clash) return { ok: false, reason: "taken" };

  // Give a freshly-created additional store a real name derived from its claimed
  // address (e.g. `psk` → "Psk", `my-shop` → "My Shop") — but only while it still
  // carries the placeholder name, so a merchant-set name is never overwritten.
  const current = await StoreModel.findById(storeId).lean<{ name?: string } | null>();
  const update: Record<string, unknown> = { subdomain: value };
  if (current?.name === "New store") update.name = storeNameFromSubdomain(value);

  try {
    await StoreModel.findByIdAndUpdate(storeId, update);
  } catch {
    // Unique-index violation from a concurrent claim of the same address.
    return { ok: false, reason: "taken" };
  }

  await recordEvent({
    type: "subdomain.claimed",
    storeId,
    actorUserId: await getActorUserId(),
    target: { kind: "store", id: storeId },
    metadata: { subdomain: value },
  });

  // Seed the builder from the chosen starting point. A tampered/unknown id (and
  // `blank`) keeps the empty config from provisioning. A failed seed must never
  // strand the merchant after their address is claimed — they just land in the
  // builder with a blank store, which is always recoverable.
  const template = isStoreTemplateId(templateId) ? buildTemplateConfig(templateId) : null;
  if (template) {
    try {
      await saveThemeConfig(storeId, template);
    } catch {
      // Claim succeeded; the template is best-effort.
    }
  }
  return { ok: true };
}

/* ============================================================
   Multi-store: switch the active store / create an additional one.
   ============================================================ */

/**
 * Switch the signed-in user's ACTIVE store. The actual write is ownership-guarded in
 * the data layer (`setActiveStoreForUser` only writes a store the user owns), so a
 * crafted `storeId` for another tenant is rejected here — this is the switch IDOR seam.
 * On success the admin layout is revalidated so every screen re-resolves to the new
 * store. Stub mode (no auth) has a single demo store, so it's a no-op success.
 */
export async function setActiveStore(storeId: string): Promise<{ ok: boolean }> {
  if (!isAuthConfigured()) return { ok: true };
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false };
  try { await assertNotImpersonating(); } catch { return { ok: false }; }
  const ok = await setActiveStoreForUser(userId, storeId);
  if (ok) revalidatePath("/", "layout");
  return { ok };
}

export type CreateStoreResult =
  | { ok: true; storeId: string }
  | { ok: false; reason: "upgrade_required"; plan: SubscriptionPlan; cap: number; count: number }
  | { ok: false; reason: "unauthenticated" };

/**
 * Create an ADDITIONAL store for the signed-in user and switch to it. Premium-gated:
 * the account's store cap (`free` = 1, `standard` = 10) is re-checked SERVER-SIDE here
 * — the switcher's "Upgrade" lock is cosmetic; this is the authoritative gate that also
 * replaces the dropped one-store-per-account DB index. `ownerId` is taken from the
 * session only, never the client. On success the new (subdomain-less) store becomes
 * active and the caller routes to `/onboarding` to claim its address.
 */
export async function createStore(): Promise<CreateStoreResult> {
  if (!isAuthConfigured()) return { ok: false, reason: "unauthenticated" };
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, reason: "unauthenticated" };

  try { await assertNotImpersonating(); } catch { return { ok: false, reason: "unauthenticated" }; }

  const status = await getStoreCapStatus(userId);
  if (status.atCap) {
    return {
      ok: false,
      reason: "upgrade_required",
      plan: status.plan,
      cap: status.cap,
      count: status.count,
    };
  }

  const storeId = await createStoreForUser(userId, {
    name: "New store",
    contactEmail: session?.user?.email ?? "",
  });
  await setActiveStoreForUser(userId, storeId);
  await recordEvent({
    type: "store.created",
    storeId,
    actorUserId: userId,
    target: { kind: "store", id: storeId },
  });
  revalidatePath("/", "layout");
  return { ok: true, storeId };
}

/** Title-case a subdomain into a friendly store name: `my-shop` → "My Shop". */
function storeNameFromSubdomain(sub: string): string {
  const name = sub
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return name || "New store";
}
