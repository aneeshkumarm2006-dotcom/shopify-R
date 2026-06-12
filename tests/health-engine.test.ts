import { test } from "node:test";
import assert from "node:assert/strict";
import type { Store, StoreStatus } from "@/types";
import { runHealthChecks, failingHealthChecks } from "@/lib/data";
import type { StoreHealthInput } from "@/lib/data/health";

/**
 * Operator health / alignment engine — `lib/data/health.ts` (pure, deterministic).
 *
 * Each rule is exercised passing AND failing, plus boundaries and case-sensitivity.
 * Fixtures are minimal-but-type-complete `Store`s built from a healthy baseline so a
 * single overridden field isolates exactly one rule.
 */

const ISO = "2026-06-08T00:00:00.000Z";

/** A fully-HEALTHY live store: every rule should pass against this baseline. */
function healthyStore(overrides: Partial<Store> = {}): Store {
  return {
    _id: "s_test",
    ownerId: "u_test",
    name: "Test Store",
    subdomain: "teststore",
    status: "live",
    ageGate: { enabled: true, minAge: 21, message: "21+ only." },
    settings: { currency: "$", contactEmail: "ops@test.co" },
    seoDefaults: { title: "Test", description: "Test store." },
    codeInjection: { headHtml: "", bodyHtml: "", customCss: "", customJs: "" },
    publishedAt: ISO,
    createdAt: ISO,
    updatedAt: ISO,
    ...overrides,
  };
}

function input(overrides: Partial<StoreHealthInput> = {}): StoreHealthInput {
  return {
    store: healthyStore(overrides.store ? { ...overrides.store } : {}),
    productCount: 5,
    daysSinceCreated: 1,
    ...overrides,
  };
}

/** Look up a single rule result by id. */
function rule(results: ReturnType<typeof runHealthChecks>, id: string) {
  const r = results.find((x) => x.id === id);
  assert.ok(r, `expected a rule with id ${id}`);
  return r!;
}

/* ============================================================
   Baseline: a healthy live store passes everything
   ============================================================ */

test("healthy live store: every rule passes and failingHealthChecks is []", () => {
  const results = runHealthChecks(input());
  assert.ok(results.every((r) => r.ok), "no rule should fail on a healthy store");
  assert.deepEqual(failingHealthChecks(input()), []);
});

test("runHealthChecks returns one result per rule (all six)", () => {
  const ids = runHealthChecks(input()).map((r) => r.id).sort();
  assert.deepEqual(ids, [
    "agegate_off_restricted",
    "code_injection_has_script",
    "live_never_published_at",
    "live_no_products",
    "live_no_subdomain",
    "stale_draft",
  ]);
});

/* ============================================================
   live_no_products (high)
   ============================================================ */

test("live_no_products: live + 0 products → FAIL", () => {
  const r = rule(runHealthChecks(input({ productCount: 0 })), "live_no_products");
  assert.equal(r.ok, false);
  assert.equal(r.severity, "high");
});

test("live_no_products: live + >0 products → ok", () => {
  const r = rule(runHealthChecks(input({ productCount: 1 })), "live_no_products");
  assert.equal(r.ok, true);
});

test("live_no_products: DRAFT + 0 products → ok (rule only applies to live)", () => {
  const r = rule(
    runHealthChecks(input({ store: healthyStore({ status: "draft" }), productCount: 0 })),
    "live_no_products",
  );
  assert.equal(r.ok, true);
});

/* ============================================================
   live_no_subdomain (high)
   ============================================================ */

test("live_no_subdomain: live + empty subdomain → FAIL", () => {
  const r = rule(
    runHealthChecks(input({ store: healthyStore({ subdomain: "" }) })),
    "live_no_subdomain",
  );
  assert.equal(r.ok, false);
  assert.equal(r.severity, "high");
});

test("live_no_subdomain: live + present subdomain → ok", () => {
  const r = rule(runHealthChecks(input()), "live_no_subdomain");
  assert.equal(r.ok, true);
});

test("live_no_subdomain: DRAFT + empty subdomain → ok (only live is checked)", () => {
  const r = rule(
    runHealthChecks(input({ store: healthyStore({ status: "draft", subdomain: "" }) })),
    "live_no_subdomain",
  );
  assert.equal(r.ok, true);
});

/* ============================================================
   agegate_off_restricted (high)
   ============================================================ */

test("agegate_off_restricted: ageGate disabled → FAIL (even if minAge ≥ 21)", () => {
  const r = rule(
    runHealthChecks(input({ store: healthyStore({ ageGate: { enabled: false, minAge: 21, message: "x" } }) })),
    "agegate_off_restricted",
  );
  assert.equal(r.ok, false);
  assert.equal(r.severity, "high");
});

test("agegate_off_restricted: enabled but minAge < 21 → FAIL", () => {
  const r = rule(
    runHealthChecks(input({ store: healthyStore({ ageGate: { enabled: true, minAge: 18, message: "x" } }) })),
    "agegate_off_restricted",
  );
  assert.equal(r.ok, false);
});

test("agegate_off_restricted: enabled + minAge exactly 21 → ok (boundary)", () => {
  const r = rule(
    runHealthChecks(input({ store: healthyStore({ ageGate: { enabled: true, minAge: 21, message: "x" } }) })),
    "agegate_off_restricted",
  );
  assert.equal(r.ok, true);
});

test("agegate_off_restricted: enabled + minAge 25 → ok", () => {
  const r = rule(
    runHealthChecks(input({ store: healthyStore({ ageGate: { enabled: true, minAge: 25, message: "x" } }) })),
    "agegate_off_restricted",
  );
  assert.equal(r.ok, true);
});

test("agegate_off_restricted: minAge 20 (just below boundary) → FAIL", () => {
  const r = rule(
    runHealthChecks(input({ store: healthyStore({ ageGate: { enabled: true, minAge: 20, message: "x" } }) })),
    "agegate_off_restricted",
  );
  assert.equal(r.ok, false);
});

test("agegate_off_restricted: applies regardless of store status (off draft still fails)", () => {
  const r = rule(
    runHealthChecks(
      input({ store: healthyStore({ status: "draft", ageGate: { enabled: false, minAge: 21, message: "x" } }) }),
    ),
    "agegate_off_restricted",
  );
  assert.equal(r.ok, false, "age-gate rule is not gated on live status");
});

/* ============================================================
   code_injection_has_script (high)
   ============================================================ */

test("code_injection_has_script: <script in headHtml → FAIL", () => {
  const store = healthyStore({
    codeInjection: { headHtml: "<script>alert(1)</script>", bodyHtml: "", customCss: "", customJs: "" },
  });
  const r = rule(runHealthChecks(input({ store })), "code_injection_has_script");
  assert.equal(r.ok, false);
  assert.equal(r.severity, "high");
});

test("code_injection_has_script: <script in bodyHtml → FAIL", () => {
  const store = healthyStore({
    codeInjection: { headHtml: "", bodyHtml: "<script src=evil.js></script>", customCss: "", customJs: "" },
  });
  assert.equal(rule(runHealthChecks(input({ store })), "code_injection_has_script").ok, false);
});

test("code_injection_has_script: <script in customJs → FAIL", () => {
  const store = healthyStore({
    codeInjection: { headHtml: "", bodyHtml: "", customCss: "", customJs: "var x='<script>'" },
  });
  assert.equal(rule(runHealthChecks(input({ store })), "code_injection_has_script").ok, false);
});

test("code_injection_has_script: javascript: URL → FAIL", () => {
  const store = healthyStore({
    codeInjection: { headHtml: "<a href='javascript:alert(1)'>x</a>", bodyHtml: "", customCss: "", customJs: "" },
  });
  assert.equal(rule(runHealthChecks(input({ store })), "code_injection_has_script").ok, false);
});

test("code_injection_has_script: case-INSENSITIVE (<SCRIPT, JavaScript:) → FAIL", () => {
  const upper = healthyStore({
    codeInjection: { headHtml: "<SCRIPT>x</SCRIPT>", bodyHtml: "", customCss: "", customJs: "" },
  });
  assert.equal(rule(runHealthChecks(input({ store: upper })), "code_injection_has_script").ok, false);

  const mixed = healthyStore({
    codeInjection: { headHtml: "", bodyHtml: "JavaScript:void(0)", customCss: "", customJs: "" },
  });
  assert.equal(rule(runHealthChecks(input({ store: mixed })), "code_injection_has_script").ok, false);
});

test("code_injection_has_script: clean / empty content → ok", () => {
  const r = rule(runHealthChecks(input()), "code_injection_has_script");
  assert.equal(r.ok, true);
});

test("code_injection_has_script: benign mention of the word 'script' (no <script) → ok", () => {
  const store = healthyStore({
    codeInjection: { headHtml: "<!-- our script policy -->", bodyHtml: "", customCss: "", customJs: "" },
  });
  assert.equal(
    rule(runHealthChecks(input({ store })), "code_injection_has_script").ok,
    true,
    "the \\b word-boundary means '<script' must be the actual tag start",
  );
});

test("code_injection_has_script: customCss `javascript:` payload IS caught", () => {
  // All four injection channels are scanned, including CSS url('javascript:...').
  const store = healthyStore({
    codeInjection: { headHtml: "", bodyHtml: "", customCss: "x{background:url('javascript:alert(1)')}", customJs: "" },
  });
  assert.equal(
    rule(runHealthChecks(input({ store })), "code_injection_has_script").ok,
    false,
    "CSS-borne javascript: payload must fail the check",
  );
});

/* ============================================================
   stale_draft (medium)
   ============================================================ */

test("stale_draft: draft + 14 days → FAIL (boundary, >= 14)", () => {
  const r = rule(
    runHealthChecks(input({ store: healthyStore({ status: "draft" }), daysSinceCreated: 14 })),
    "stale_draft",
  );
  assert.equal(r.ok, false);
  assert.equal(r.severity, "medium");
});

test("stale_draft: draft + 13 days → ok (just under threshold)", () => {
  const r = rule(
    runHealthChecks(input({ store: healthyStore({ status: "draft" }), daysSinceCreated: 13 })),
    "stale_draft",
  );
  assert.equal(r.ok, true);
});

test("stale_draft: draft + 100 days → FAIL", () => {
  const r = rule(
    runHealthChecks(input({ store: healthyStore({ status: "draft" }), daysSinceCreated: 100 })),
    "stale_draft",
  );
  assert.equal(r.ok, false);
});

test("stale_draft: LIVE + old (100 days) → ok (rule only applies to drafts)", () => {
  const r = rule(runHealthChecks(input({ daysSinceCreated: 100 })), "stale_draft");
  assert.equal(r.ok, true);
});

/* ============================================================
   live_never_published_at (low)
   ============================================================ */

test("live_never_published_at: live + no publishedAt → FAIL", () => {
  const store = healthyStore({ publishedAt: undefined });
  const r = rule(runHealthChecks(input({ store })), "live_never_published_at");
  assert.equal(r.ok, false);
  assert.equal(r.severity, "low");
});

test("live_never_published_at: live + publishedAt present → ok", () => {
  const r = rule(runHealthChecks(input()), "live_never_published_at");
  assert.equal(r.ok, true);
});

test("live_never_published_at: DRAFT + no publishedAt → ok (only live is checked)", () => {
  const store = healthyStore({ status: "draft", publishedAt: undefined });
  const r = rule(runHealthChecks(input({ store })), "live_never_published_at");
  assert.equal(r.ok, true);
});

test("live_never_published_at: empty-string publishedAt on a live store → FAIL (falsy)", () => {
  const store = healthyStore({ publishedAt: "" });
  const r = rule(runHealthChecks(input({ store })), "live_never_published_at");
  assert.equal(r.ok, false, "an empty timestamp is treated as missing");
});

/* ============================================================
   severity map (full)
   ============================================================ */

test("severity values are correct per rule", () => {
  const results = runHealthChecks(input());
  const sev = Object.fromEntries(results.map((r) => [r.id, r.severity]));
  assert.deepEqual(sev, {
    live_no_products: "high",
    live_no_subdomain: "high",
    agegate_off_restricted: "high",
    code_injection_has_script: "high",
    stale_draft: "medium",
    live_never_published_at: "low",
  });
});

/* ============================================================
   failingHealthChecks aggregation
   ============================================================ */

test("failingHealthChecks: returns only the !ok subset", () => {
  // Live store with 0 products + empty subdomain: exactly two high rules fail.
  const store = healthyStore({ subdomain: "" });
  const failing = failingHealthChecks(input({ store, productCount: 0 }));
  const ids = failing.map((r) => r.id).sort();
  assert.deepEqual(ids, ["live_no_products", "live_no_subdomain"]);
  assert.ok(failing.every((r) => r.ok === false));
});

test("failingHealthChecks: a store failing MULTIPLE rules returns ALL of them", () => {
  // Misaligned live store: no products, no subdomain, age gate off, injected script,
  // and never published. Five rules should fail (stale_draft stays ok — it's live).
  const store = healthyStore({
    subdomain: "",
    ageGate: { enabled: false, minAge: 18, message: "x" },
    codeInjection: { headHtml: "<script>steal()</script>", bodyHtml: "", customCss: "", customJs: "" },
    publishedAt: undefined,
  });
  const failing = failingHealthChecks(input({ store, productCount: 0 }));
  const ids = failing.map((r) => r.id).sort();
  assert.deepEqual(ids, [
    "agegate_off_restricted",
    "code_injection_has_script",
    "live_never_published_at",
    "live_no_products",
    "live_no_subdomain",
  ]);
  assert.ok(!ids.includes("stale_draft"), "stale_draft must not fire on a live store");
});

test("failingHealthChecks: an abandoned old draft fails stale_draft and age-gate only", () => {
  // Draft store, 30 days old, age gate off. live_* rules don't apply to drafts.
  const store = healthyStore({
    status: "draft" as StoreStatus,
    subdomain: "",
    publishedAt: undefined,
    ageGate: { enabled: false, minAge: 21, message: "x" },
  });
  const failing = failingHealthChecks(input({ store, productCount: 0, daysSinceCreated: 30 }));
  const ids = failing.map((r) => r.id).sort();
  assert.deepEqual(ids, ["agegate_off_restricted", "stale_draft"]);
});

/* ============================================================
   determinism / purity
   ============================================================ */

test("runHealthChecks is pure: same input → identical output, no input mutation", () => {
  const original = input({ store: healthyStore({ subdomain: "" }), productCount: 0 });
  const snapshot = structuredClone(original);
  const a = runHealthChecks(original);
  const b = runHealthChecks(original);
  assert.deepEqual(a, b);
  assert.deepEqual(original, snapshot, "the input must not be mutated");
});
