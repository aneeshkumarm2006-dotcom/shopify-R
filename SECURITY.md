# Offshelf — Security & isolation notes (Stage 14)

This records the Stage 14 hardening audit (PRD §9). Runnable proofs live in `tests/`
(`npm test`); the prose below is the reasoning those tests pin down.

## 1. Tenant isolation (PRD §9)

**Conclusion: cross-store access is blocked by construction, not by discipline.**

- Every store-scoped collection (products, collections, inventoryAdjustments, orders,
  customers, carts) is reachable only through a `StoreScopedRepository`
  (`lib/db/repo.ts`). The repo holds the Mongoose model in a private field (`#model`)
  with no getter, so there is no escape hatch to the raw, unscoped model.
- Every repository method builds its filter with `scopedFilter(storeId, …)`
  (`lib/db/scope.ts`), which **injects** `storeId` and **throws** (`TenantScopeError`)
  on a missing/empty id — a forgotten scope fails loud instead of reading across
  tenants. It also strips any caller-supplied `storeId`, so a request can never
  override or invert the scope (`{ storeId: { $ne: … } }` is dropped).
- The few direct-model reads outside the repo were audited and are correctly scoped:
  - `lib/data/store.ts` — the `stores` collection is keyed by its own `_id`, so
    `findById(storeId)` *is* the tenant scope; owner/subscription resolve by `storeId`.
  - `lib/data/theme.ts` — uses `scopedFilter(storeId)` on both read and upsert.
  - `lib/data/platform.ts` — **intentionally** cross-tenant (internal operator view);
    gated behind `requirePlatformAdmin` (see §3).
- No module outside `lib/db` imports a model directly (verified by grep).
- Server actions resolve `storeId` from the session via `requireMerchantStoreId()`,
  never from the client payload, so a merchant can only ever act on their own store.

Tests: `tests/tenant-isolation.test.ts` (incl. explicit cross-store denial cases).

## 2. Code-injection sanitization & self-XSS scope (PRD §9)

Code injection (head/body HTML, custom CSS/JS) is a first-class merchant feature, so
`<script>` is **intentionally allowed** (analytics, pixels, chat widgets). The residual
risk is **self-XSS**: a merchant running JS on *their own* storefront against *their own*
visitors.

That risk is bounded by architecture, not the sanitizer:

- Injected code renders **only** in the `(store)` route group — never in `(admin)` or
  `(marketing)`.
- In production each storefront serves on its own `*.<APP_DOMAIN>` subdomain, a separate
  origin from the admin app and from every other tenant. Same-origin policy means
  injected JS cannot read the admin session cookie, reach the dashboard, or touch another
  store. Blast radius = one store's own visitors.

What the sanitizer (`lib/sanitize/inject.ts`) **does** enforce — the cases that could
escape the storefront box or corrupt the document:

- `<base>` is removed (relative-URL / navigation-hijack primitive).
- `</style>` / `<script>` breakouts are stripped from the CSS channel; `</script>` is
  escaped in the JS channel — a value in one channel can't smuggle markup into the page.
- Each field is length-capped (20k) against runaway pastes.

The Settings UI surfaces this ("Code that could affect the Offshelf shell is sanitized").
Tests: `tests/sanitize.test.ts`.

## 3. Subdomain abuse blocklist & store suspension (PRD §9)

- **Reserved-word + DNS-safe blocklist** (`lib/tenant/host.ts`) is the single source of
  truth, shared by the Edge `middleware.ts`, the storefront resolver, and the onboarding/
  claim validators (`lib/auth/actions.ts` re-validates server-side — never trusting the
  client). Reserved labels (`admin`, `api`, `app`, `www`, …) and malformed labels resolve
  to the platform app, never a tenant. Tests: `tests/subdomain.test.ts`.
- **Suspension takes a store offline.** The platform operator suspends a store
  (`status: suspended`) via `setStoreStatusAction` → `setStoreStatusBySubdomain`, which
  persists the status. `resolveStorefront` (`lib/tenant/resolve.ts`) serves **only**
  `status: "live"`, so a suspended (or draft) store stops serving immediately.
- **Platform surface is role-gated.** `app/(admin)/platform` and its action both call
  `requirePlatformAdmin()` — anonymous → `/sign-in`, signed-in non-admin → `notFound()`
  (the route's existence isn't disclosed). This is enforced on the server action too, not
  just the page, since the action is a public endpoint.
