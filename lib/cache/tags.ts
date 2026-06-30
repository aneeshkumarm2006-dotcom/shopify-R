/**
 * Cache-tag taxonomy for tenant-safe storefront DATA caching (PRD §9 — tenant
 * isolation is non-negotiable).
 *
 * THE ONE RULE: every store-scoped tag is prefixed with `store:${storeId}`. A
 * `revalidateTag` fired for store A can therefore NEVER drop store B's entry, and
 * — combined with `cachedByStore` putting `storeId` in the key — a cache entry for
 * store A can never be SERVED to store B. When in doubt, scope MORE, never less.
 *
 * The lone exception that is intentionally NOT store-prefixed is `subdomainTag`:
 * it keys the subdomain→store resolution read, which by definition runs BEFORE we
 * know the storeId. It is paired with the store's `recordTag` inside that loader so
 * busting either one drops the entry (see lib/data/store.ts getStoreBySubdomain).
 */

import { requireStoreId } from "@/lib/db/scope";

/** Coarse tenant tag — nuke an entire store's cached reads (publish/suspend). */
export function storeTag(storeId: string): string {
  return `store:${requireStoreId(storeId)}`;
}

/** The store record itself (name, settings, status, subdomain, …). */
export function recordTag(storeId: string): string {
  return `${storeTag(storeId)}:record`;
}

/** The store's themeConfig (builder output the storefront SSRs). */
export function themeTag(storeId: string): string {
  return `${storeTag(storeId)}:theme`;
}

/** Any product LIST / facet / by-ids read for the store. */
export function productsTag(storeId: string): string {
  return `${storeTag(storeId)}:products`;
}

/** A single product addressed by its (per-store-unique) handle. */
export function productTag(storeId: string, handle: string): string {
  return `${storeTag(storeId)}:product:${handle}`;
}

/** Collection lists + a single collection + its (smart/manual) membership. */
export function collectionsTag(storeId: string): string {
  return `${storeTag(storeId)}:collections`;
}

/** Storefront reviews for the store. */
export function reviewsTag(storeId: string): string {
  return `${storeTag(storeId)}:reviews`;
}

/**
 * Subdomain-resolution tag — the ONLY tag not prefixed with `store:`. Used solely
 * by `getStoreBySubdomain`'s cache, alongside the resolved store's `recordTag`, so
 * publish/suspend (which know the subdomain) can drop the resolution entry even
 * before the storeId is in hand.
 */
export function subdomainTag(subdomain: string): string {
  return `subdomain:${subdomain.toLowerCase()}`;
}
