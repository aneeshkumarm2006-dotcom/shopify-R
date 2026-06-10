"use server";

import { isDbConfigured, dbConnect, StoreModel } from "@/lib/db";
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
import { auth, signIn, signOut, isAuthConfigured } from "./index";

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

/** Account menu → end the session (or, stubbed, just return to sign-in). */
export async function doSignOut(): Promise<void> {
  if (!isAuthConfigured()) {
    const { redirect } = await import("next/navigation");
    redirect("/sign-in");
  }
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
  const session = await auth();
  const ownStoreId = session?.user?.storeId;
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

  const session = await auth();
  const storeId = session?.user?.storeId;
  if (!storeId) return { ok: false, reason: "invalid" }; // not signed in

  await dbConnect();
  const clash = await StoreModel.findOne({ subdomain: value, _id: { $ne: storeId } }).lean();
  if (clash) return { ok: false, reason: "taken" };

  try {
    await StoreModel.findByIdAndUpdate(storeId, { subdomain: value });
  } catch {
    // Unique-index violation from a concurrent claim of the same address.
    return { ok: false, reason: "taken" };
  }

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
