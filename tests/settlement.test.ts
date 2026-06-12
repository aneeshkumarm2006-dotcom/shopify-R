import { test } from "node:test";
import assert from "node:assert/strict";
import { enabledSettlements } from "@/lib/data";
import type { Store } from "@/types";

/**
 * Settlement-method resolution — `enabledSettlements(store)`.
 *
 * This is the gate checkout consults to decide whether a chosen `settlementMethod`
 * is allowed. Two contracts matter: (1) safe defaults when a store hasn't configured
 * settlement (online ON, the riskier offline methods OFF), and (2) the deliberate
 * key remap `settings.settlement.inStore` → the `SettlementMethod` key `in_store`.
 * A mismatch there would silently disable / mis-enable pay-in-store at checkout.
 */

/** Minimal Store with only the fields `enabledSettlements` reads. */
function store(settlement?: Store["settings"]["settlement"]): Store {
  return {
    _id: "s1",
    ownerId: "u1",
    name: "S",
    subdomain: "s",
    status: "live",
    ageGate: { enabled: false, minAge: 21, message: "" },
    settings: {
      currency: "$",
      contactEmail: "x@y.z",
      ...(settlement ? { settlement } : {}),
    },
    seoDefaults: { title: "", description: "" },
    codeInjection: { headHtml: "", bodyHtml: "", customCss: "", customJs: "" },
    createdAt: "",
    updatedAt: "",
  };
}

test("no settlement config → safe defaults (online on, cod/in_store off)", () => {
  assert.deepEqual(enabledSettlements(store()), {
    online: true,
    cod: false,
    in_store: false,
  });
});

test("returned object keys are EXACTLY online / cod / in_store", () => {
  assert.deepEqual(Object.keys(enabledSettlements(store())).sort(), ["cod", "in_store", "online"]);
});

test("explicit flags are honored verbatim", () => {
  assert.deepEqual(enabledSettlements(store({ online: false, cod: true, inStore: true })), {
    online: false,
    cod: true,
    in_store: true,
  });
});

test("KEY REMAP: settings.inStore maps onto the in_store SettlementMethod key", () => {
  const result = enabledSettlements(store({ online: false, cod: false, inStore: true }));
  // The store turned ON pay-in-store; checkout must see it under `in_store`.
  assert.equal(result.in_store, true);
  // And there must be no leaked camelCase key.
  assert.equal("inStore" in result, false);
});

test("a store offering ONLY cod disables online and in_store", () => {
  assert.deepEqual(enabledSettlements(store({ online: false, cod: true, inStore: false })), {
    online: false,
    cod: true,
    in_store: false,
  });
});

test("all methods can be enabled at once", () => {
  assert.deepEqual(enabledSettlements(store({ online: true, cod: true, inStore: true })), {
    online: true,
    cod: true,
    in_store: true,
  });
});
