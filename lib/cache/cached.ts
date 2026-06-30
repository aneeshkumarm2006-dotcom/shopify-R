/**
 * Tenant-safe data-cache wrapper (PRD §9). A thin shim that sits INSIDE the
 * existing data seams: it removes the per-pageview DB hit for shared,
 * non-personalized reads without changing any call site, page, or signature.
 *
 * THE SAFETY CONTRACT (tenant isolation — non-negotiable):
 *   1. `requireStoreId` runs FIRST. A missing/blank storeId fails LOUD; it must
 *      NEVER fall through to a global, cross-tenant cache entry.
 *   2. `storeId` is ALWAYS the 2nd element of the `unstable_cache` key, so two
 *      stores can't collide on the same resource+discriminators.
 *   3. Every caller-supplied tag MUST start with `store:${storeId}` (defense in
 *      depth — a stray global tag would let one store's revalidate touch another).
 *
 * The mock/demo path (`!isDbConfigured()`) BYPASSES the cache entirely so Part A
 * stays byte-identical to today: no `unstable_cache`, no tags, just `loader()`.
 */

import { unstable_cache } from "next/cache";
import { isDbConfigured } from "@/lib/db";
import { requireStoreId, TenantScopeError } from "@/lib/db/scope";

/** Backstop TTL (seconds): even if a tag is missed, no entry serves forever-stale. */
const DEFAULT_REVALIDATE = 600;

export interface CachedByStoreOpts {
  /** Override the backstop TTL (seconds). Defaults to 600. */
  revalidate?: number;
  /**
   * When true, a `null` / `undefined` result is returned WITHOUT being cached.
   * Needed for tenant resolution (unknown subdomain) and product-by-handle, where
   * pinning a miss would keep a later-created resource 404ing until the TTL.
   */
  skipNull?: boolean;
}

/**
 * Memoize a store-scoped DATA read behind `unstable_cache`, keyed + tagged per
 * tenant. Returns `loader()`'s result unchanged.
 *
 * @param storeId        the tenant scope (validated first — throws if blank)
 * @param resource       a stable resource name, e.g. "products" / "collection"
 * @param discriminators stable extra key parts (status, serialized query, handle…)
 * @param tags           caller-supplied tags; EACH must start with `store:${storeId}`
 * @param loader         the underlying read (the existing DB query)
 * @param opts           { revalidate?, skipNull? }
 */
export async function cachedByStore<TResult>(
  storeId: string,
  resource: string,
  discriminators: (string | number)[],
  tags: string[],
  loader: () => Promise<TResult>,
  opts: CachedByStoreOpts = {},
): Promise<TResult> {
  // (1) Fail loud on a missing scope BEFORE anything else — never a global entry.
  const id = requireStoreId(storeId);

  // Mock/demo path: no DB, no cache. Byte-identical to the pre-cache behavior.
  if (!isDbConfigured()) {
    return loader();
  }

  // (3) Defense in depth: refuse any tag that isn't scoped to THIS store.
  const prefix = `store:${id}`;
  for (const tag of tags) {
    if (!tag.startsWith(prefix)) {
      throw new TenantScopeError(
        `Cache tag "${tag}" is not scoped to store "${id}" (must start with "${prefix}"). Refusing to build a cross-tenant cache entry.`,
      );
    }
  }

  // (2) storeId is ALWAYS the 2nd key element so stores can never collide.
  const keyParts = ["store", id, resource, ...discriminators.map(String)];

  if (opts.skipNull) {
    // Wrap the result so a null/undefined can be detected and re-checked WITHOUT
    // being persisted as a cached value.
    const wrapped = unstable_cache(
      async () => {
        const value = await loader();
        return value === null || value === undefined
          ? { hit: false as const }
          : { hit: true as const, value };
      },
      keyParts,
      { tags, revalidate: opts.revalidate ?? DEFAULT_REVALIDATE },
    );
    const out = await wrapped();
    // A miss is never cached: re-run the loader live so a just-created resource
    // (e.g. a newly published subdomain) resolves immediately, not after the TTL.
    if (!out.hit) return loader();
    return out.value;
  }

  const wrapped = unstable_cache(loader, keyParts, {
    tags,
    revalidate: opts.revalidate ?? DEFAULT_REVALIDATE,
  });
  return wrapped();
}

/**
 * Build the exact cache key `cachedByStore` would use, WITHOUT executing anything.
 * Exposed for the isolation tests so they can prove two stores never collide.
 */
export function buildCacheKey(
  storeId: string,
  resource: string,
  discriminators: (string | number)[],
): string[] {
  const id = requireStoreId(storeId);
  return ["store", id, resource, ...discriminators.map(String)];
}
