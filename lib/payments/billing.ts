import type { SubscriptionPlan } from "@/types";
import type {
  BillingPortalSession,
  BillingProvider,
  BillingSeam,
  PlanDefinition,
} from "./types";

/**
 * Platform billing seam (Stage 12, PRD §2.3 / §6.11 — merchant → Offshelf).
 *
 * Subscriptions are **provisioned manually** in the MVP: first-login provisioning
 * (`lib/auth/provision.ts`) writes an `active` `free` `subscription` with an empty
 * `billingSeam`. This module owns the plan catalog the Settings billing card reads
 * and the typed handoff a future billing processor fills in (`BillingSeam`,
 * `getBillingPortalSession`). `free` / `standard` are placeholders — the figures
 * here are illustrative until billing goes live.
 */

const PROVIDER_ID = process.env.BILLING_PROVIDER ?? "";

/** True once a billing processor is configured; manual provisioning otherwise. */
export function isBillingConfigured(): boolean {
  return Boolean(PROVIDER_ID);
}

/** Placeholder plan catalog (PRD §5.10). Prices are illustrative, not billed. */
export const PLAN_CATALOG: Record<SubscriptionPlan, PlanDefinition> = {
  free: {
    id: "free",
    name: "Free",
    priceMonthly: 0,
    currency: "$",
    features: ["1 store", "Storefront builder", "Up to 50 products", "Manual order settlement"],
    storeCap: 1,
  },
  standard: {
    id: "standard",
    name: "Standard",
    priceMonthly: 29,
    currency: "$",
    features: ["Up to 10 stores", "Unlimited products", "Custom code injection", "Priority support"],
    storeCap: 10,
  },
};

/** Look up a plan definition, falling back to `free`. */
export function getPlan(plan: SubscriptionPlan): PlanDefinition {
  return PLAN_CATALOG[plan] ?? PLAN_CATALOG.free;
}

/**
 * Max stores an account on `plan` may own. `getPlan` falls back to `free`, so an
 * unknown/absent plan safely caps at 1. This is the single source of truth the
 * `createStore` action re-checks server-side and the switcher reads to lock "Create".
 */
export function storeCapForPlan(plan: SubscriptionPlan): number {
  return getPlan(plan).storeCap;
}

/** The catalog as an ordered list (free → standard) for plan-comparison UIs. */
export function listPlans(): PlanDefinition[] {
  return [PLAN_CATALOG.free, PLAN_CATALOG.standard];
}

/** A blank `subscription.billingSeam` — the shape a processor later populates. */
export function emptyBillingSeam(): BillingSeam {
  return {};
}

/** The MVP provider: a documented no-op (no hosted portal until billing is live). */
const stubBillingProvider: BillingProvider = {
  id: "stub",
  async getPortalSession() {
    return null;
  },
};

function activeBillingProvider(): BillingProvider {
  return stubBillingProvider;
}

/**
 * Billing seam: a hosted-portal handoff for a merchant to manage their plan.
 * `null` in the MVP (the "Manage billing" button stays disabled); a processor
 * adapter returns a real session URL with no Settings-screen changes.
 */
export async function getBillingPortalSession(
  storeId: string,
): Promise<BillingPortalSession | null> {
  return activeBillingProvider().getPortalSession(storeId);
}
