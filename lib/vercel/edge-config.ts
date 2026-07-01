/**
 * Edge Config routing-cache writer (Phase 3). The project has an Edge Config store
 * connected (Vercel auto-set the `EDGE_CONFIG` env var) and `middleware.ts` reads it
 * (via the `@vercel/edge-config` SDK, read-only) to resolve a verified custom domain
 * to its store subdomain at the edge, without a DB round-trip per request.
 *
 * WRITES don't go through the SDK (it's read-only) — they go straight to Vercel's
 * Edge Config REST API using the same `VERCEL_API_TOKEN` already used by
 * `lib/vercel/domains.ts`. Env is read lazily inside each call (not at module load),
 * matching that file's convention, so a missing/misconfigured Edge Config degrades
 * the routing cache (middleware falls back to "not a custom domain" / `next()`)
 * rather than crashing the verification flow that calls this.
 *
 * Server-only.
 */

import { edgeConfigDomainKey, type EdgeDomainEntry } from "@/lib/tenant/host";

const VERCEL_API_BASE = "https://api.vercel.com";

interface EdgeConfigWriteEnv {
  token: string;
  edgeConfigId: string;
}

/** Extract the Edge Config id (e.g. `ecfg_xxx`) from the `EDGE_CONFIG` connection
 * string (`https://edge-config.vercel.com/<id>?token=<readToken>`). Pure/no I/O. */
function parseEdgeConfigId(connectionString: string): string {
  const match = connectionString.match(/edge-config\.vercel\.com\/([^/?]+)/);
  const id = match?.[1];
  if (!id) {
    throw new Error("Malformed EDGE_CONFIG connection string");
  }
  return id;
}

/** Resolve + validate the env needed to WRITE to Edge Config. Returns `null` (not a
 * throw) when unset, so callers can log-and-no-op instead of breaking the domain
 * verification flow that triggers these writes. */
function getEdgeConfigWriteEnv(): EdgeConfigWriteEnv | null {
  const connectionString = process.env.EDGE_CONFIG;
  const token = process.env.VERCEL_API_TOKEN;
  if (!connectionString || !token) return null;
  try {
    return { token, edgeConfigId: parseEdgeConfigId(connectionString) };
  } catch (err) {
    console.error("[vercel/edge-config] failed to parse EDGE_CONFIG connection string", err);
    return null;
  }
}

/** Single PATCH item, applied to the Edge Config's `items` endpoint. Shared by both
 * upsert (sync) and delete (remove) below. NOTE: the response-shape assumption here
 * (2xx on success, JSON `{ error: { message } }` on failure) mirrors Vercel's
 * documented Edge Config API but is unverified against a live call in this
 * sandbox — same caveat as the Phase 2 Domains API wrapper. */
async function patchEdgeConfigItem(
  env: EdgeConfigWriteEnv,
  item: { operation: "upsert" | "delete"; key: string; value?: unknown },
): Promise<void> {
  const res = await fetch(`${VERCEL_API_BASE}/v1/edge-config/${env.edgeConfigId}/items`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${env.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ items: [item] }),
    cache: "no-store",
  });
  if (res.ok) return;

  let message = `Edge Config write failed (${res.status})`;
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    if (body?.error?.message) message = body.error.message;
  } catch {
    /* non-JSON error body — keep the generic message */
  }
  throw new Error(message);
}

/**
 * Sync a newly-verified custom domain into the Edge Config routing cache so
 * `middleware.ts` can resolve `domain -> subdomain` at the edge. Upserts
 * `{ [lowercased domain]: subdomain }`.
 *
 * Soft-dependency by design: if `EDGE_CONFIG` / `VERCEL_API_TOKEN` are unset, this
 * logs a warning and returns — the domain still gets marked `verified` in Mongo by
 * the caller; only the edge routing cache is degraded (middleware's Edge Config
 * lookup simply won't find this domain and will fall through to the platform app
 * until the cache is backfilled). Throws on a genuine write failure (non-2xx from
 * Vercel) so the caller's existing try/catch can log it — callers must not let this
 * throw break their overall success response (confirmed at both call sites: the
 * domains admin action and the cron sweep already wrap their post-verification work
 * appropriately, see those files).
 */
export async function syncVerifiedDomainToEdgeConfig(
  domain: string,
  subdomain: string,
): Promise<{ synced: boolean; reason?: string }> {
  const env = getEdgeConfigWriteEnv();
  if (!env) {
    const reason =
      "The routing cache isn't configured on this deployment (EDGE_CONFIG or VERCEL_API_TOKEN missing).";
    console.warn("[vercel/edge-config] " + reason + " — skipping routing-cache sync", { domain });
    return { synced: false, reason };
  }
  const hostname = domain.trim().toLowerCase();
  const entry: EdgeDomainEntry = { h: hostname, s: subdomain };
  try {
    await patchEdgeConfigItem(env, {
      operation: "upsert",
      // Key must be Edge-Config-safe ([A-Za-z0-9_-], ≤32 chars) — a raw domain (dots,
      // length) is rejected. `edgeConfigDomainKey` hashes it; the hostname is kept in
      // the value so middleware can verify it on read (collision-safe).
      key: edgeConfigDomainKey(hostname),
      value: entry,
    });
    return { synced: true };
  } catch (err) {
    // Return the reason instead of throwing so the caller can surface it to the admin
    // (a verified domain that didn't sync won't route — that must be visible, not
    // hidden in server logs). The write failure is still logged with full detail.
    const reason = err instanceof Error ? err.message : "Edge Config write failed.";
    console.error("[vercel/edge-config] routing-cache write failed", { domain, err });
    return { synced: false, reason };
  }
}

/**
 * Remove a custom domain from the Edge Config routing cache (called alongside
 * `removeProjectDomain` when a merchant detaches a domain) so it stops routing to a
 * store immediately rather than lingering in the cache until overwritten.
 *
 * Same soft-dependency posture as the sync above: unset env → warn + no-op rather
 * than block domain removal.
 */
export async function removeDomainFromEdgeConfig(domain: string): Promise<void> {
  const env = getEdgeConfigWriteEnv();
  if (!env) {
    console.warn(
      "[vercel/edge-config] EDGE_CONFIG or VERCEL_API_TOKEN not set — skipping routing-cache removal",
      { domain },
    );
    return;
  }
  await patchEdgeConfigItem(env, {
    operation: "delete",
    key: edgeConfigDomainKey(domain),
  });
}
