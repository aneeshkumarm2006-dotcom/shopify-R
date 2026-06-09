/**
 * Subdomain validation — intentionally CLIENT-SAFE (no DB, no Mongoose import).
 *
 * The onboarding form calls `checkSubdomain` directly in the browser for instant
 * feedback, so this module must never reach the server-only `lib/db` graph. The
 * real persisted uniqueness claim against MongoDB happens server-side in Stage 7;
 * this provides format + reserved-word validation and (in Part A) a mock
 * uniqueness check.
 *
 * The reserved-word list + DNS-safe rule live in the edge-safe `lib/tenant/host`
 * (shared with Stage 8's `middleware.ts`); re-exported here so onboarding's existing
 * imports are unchanged and there is one source of truth.
 */
import { mockPlatformStores } from "./mocks/stats";
import { RESERVED_SUBDOMAINS, isDnsSafeSubdomain } from "@/lib/tenant/host";

export { RESERVED_SUBDOMAINS, isDnsSafeSubdomain };

export interface SubdomainCheck {
  available: boolean;
  reason?: "taken" | "reserved" | "invalid";
}

/**
 * Validate format + reserved-word blocklist + (mock) uniqueness. Used by
 * onboarding (Stage 2). Stage 7 layers a real DB uniqueness check on top via an
 * API route, reusing the format/reserved rules here.
 */
export async function checkSubdomain(subdomain: string): Promise<SubdomainCheck> {
  const value = subdomain.trim().toLowerCase();
  if (!isDnsSafeSubdomain(value)) {
    return { available: false, reason: "invalid" };
  }
  if (RESERVED_SUBDOMAINS.includes(value)) {
    return { available: false, reason: "reserved" };
  }
  const taken = mockPlatformStores.some((s) => s.subdomain === value);
  return taken ? { available: false, reason: "taken" } : { available: true };
}
