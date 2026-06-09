/**
 * Tenant-scope guard (PRD §9 — "every store-scoped query MUST filter by
 * `storeId`; enforce at the data-access layer to prevent cross-store leakage").
 *
 * This is the single chokepoint every store-scoped query passes through. Filters
 * are built by `scopedFilter`, which *injects* `storeId` and refuses to proceed
 * if it is missing or empty — so a forgotten `storeId` fails loudly instead of
 * silently reading across tenants. It also strips any caller-supplied `storeId`
 * from the extra filter so a request can never override the scope.
 */

export class TenantScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantScopeError";
  }
}

/** Validate a storeId is present and well-formed; returns it for chaining. */
export function requireStoreId(storeId: string): string {
  if (typeof storeId !== "string" || storeId.trim() === "") {
    throw new TenantScopeError(
      "A non-empty storeId is required for every store-scoped query (tenant isolation, PRD §9).",
    );
  }
  return storeId;
}

/**
 * Build a query filter that is guaranteed to be scoped to one store. The
 * caller's `extra` filter cannot smuggle in or override `storeId` — it is always
 * forced to the validated value.
 */
export function scopedFilter(
  storeId: string,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  const validated = requireStoreId(storeId);
  // Drop any storeId the caller tried to pass; scope is non-negotiable.
  const { storeId: _ignored, ...rest } = extra;
  void _ignored;
  return { ...rest, storeId: validated };
}
