/**
 * Shared helpers for the stub data-access layer.
 *
 * `clone` returns a deep copy so callers can't mutate the shared fixtures (a real
 * DB hands back fresh objects per query). `resolve` wraps a value as a Promise so
 * every seam is `async` today — Part B swaps the body for a real `storeId`-scoped
 * query without changing the signature or call sites.
 */
export function clone<T>(value: T): T {
  return structuredClone(value);
}

export async function resolve<T>(value: T): Promise<T> {
  return clone(value);
}

/** Guard used by every store-scoped seam — keeps `storeId` filtering explicit. */
export function scoped<T extends { storeId: string }>(rows: T[], storeId: string): T[] {
  return rows.filter((r) => r.storeId === storeId);
}
