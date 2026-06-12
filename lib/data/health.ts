import type { HealthCheckResult, Store } from "@/types";

/**
 * Store "alignment" / health engine (operator portal). Pure, deterministic rules that
 * answer the operator's question — "is this store in a proper state?" Each rule returns
 * `ok` plus a human message; a store is misaligned when any rule fails. The data layer
 * gathers the inputs (counts, dates) cross-tenant and calls `runHealthChecks`.
 */

export interface StoreHealthInput {
  store: Store;
  productCount: number;
  /** Whole days since the store was created (for stale-draft detection). */
  daysSinceCreated: number;
}

const SCRIPT_RE = /<script\b|javascript:/i;

function hasInjectedScript(store: Store): boolean {
  const ci = store.codeInjection;
  // Scan all four channels — `javascript:` can ride in a CSS url() too.
  return (
    SCRIPT_RE.test(ci.headHtml) ||
    SCRIPT_RE.test(ci.bodyHtml) ||
    SCRIPT_RE.test(ci.customJs) ||
    SCRIPT_RE.test(ci.customCss)
  );
}

export function runHealthChecks(input: StoreHealthInput): HealthCheckResult[] {
  const { store, productCount, daysSinceCreated } = input;
  const live = store.status === "live";

  return [
    {
      id: "live_no_products",
      severity: "high",
      ok: !(live && productCount === 0),
      message: "Live store has no active products to sell.",
    },
    {
      id: "live_no_subdomain",
      severity: "high",
      ok: !(live && !store.subdomain),
      message: "Live store has no claimed address (data drift).",
    },
    {
      id: "agegate_off_restricted",
      severity: "high",
      ok: store.ageGate.enabled && store.ageGate.minAge >= 21,
      message: "Age gate is off or below 21 on a restricted-vertical store.",
    },
    {
      id: "code_injection_has_script",
      severity: "high",
      ok: !hasInjectedScript(store),
      message: "Custom code injection contains a script — review for policy/XSS.",
    },
    {
      id: "stale_draft",
      severity: "medium",
      ok: !(store.status === "draft" && daysSinceCreated >= 14),
      message: "Draft store with no progress for 14+ days (possible abandoned onboarding).",
    },
    {
      id: "live_never_published_at",
      severity: "low",
      ok: !(live && !store.publishedAt),
      message: "Live store is missing its first-publish timestamp (data drift).",
    },
  ];
}

/** Convenience: just the failing checks (what the operator UI flags). */
export function failingHealthChecks(input: StoreHealthInput): HealthCheckResult[] {
  return runHealthChecks(input).filter((r) => !r.ok);
}
