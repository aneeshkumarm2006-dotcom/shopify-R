import type { DomainVerificationChallenge } from "@/types";

/**
 * Vercel Domains API wrapper (Phase 2 of per-store custom domains). Talks to
 * `https://api.vercel.com` using `VERCEL_API_TOKEN` + `VERCEL_PROJECT_ID` from env.
 * This is a PERSONAL Vercel account (no team) — calls deliberately omit any `teamId`
 * query param; do not add one back without re-checking the account type.
 *
 * Env is read lazily inside each call (not at module load) so the rest of the app
 * keeps working when these vars are unset — only the domain-connect flow breaks,
 * with a clear error surfaced to the caller instead of a crash at import time.
 *
 * Server-only.
 */

const VERCEL_API_BASE = "https://api.vercel.com";

/**
 * Fallback apex A-record IP used when Vercel's config API doesn't surface a
 * project-specific recommended IP (or the call fails). Vercel assigns the apex IP
 * PER PROJECT/PLAN — it can be `76.76.21.21`, `216.198.79.1`, or others — so this
 * constant is only a last resort. Resolution order is: API recommendation →
 * `VERCEL_APEX_IP` env override → this default. `216.198.79.1` is Vercel's current
 * default apex IP (the older `76.76.21.21` is stale for newer projects).
 */
const DEFAULT_VERCEL_APEX_IP = "216.198.79.1";

/** Basic IPv4 shape check so we never hand a merchant a malformed A-record value
 * from an unexpected API response. */
function isIpv4(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/.test(value)
  );
}

/**
 * Resolve the apex A-record IP a merchant should publish, in priority order:
 *   1. `recommendedIp` — a project-specific value read from Vercel's config API
 *      (the correct source of truth, since Vercel assigns the apex IP per project).
 *   2. `VERCEL_APEX_IP` env override — lets an operator pin the value per deployment
 *      without a code change if the API path ever stops surfacing it.
 *   3. `DEFAULT_VERCEL_APEX_IP` — Vercel's current default, correct for most projects.
 * Any malformed/blank candidate is skipped rather than trusted.
 */
export function resolveApexIp(recommendedIp?: string | null): string {
  if (isIpv4(recommendedIp)) return recommendedIp;
  const envIp = process.env.VERCEL_APEX_IP?.trim();
  if (isIpv4(envIp)) return envIp;
  return DEFAULT_VERCEL_APEX_IP;
}

/** The `rank` of a `recommendedIPv4` entry (rank=1 is Vercel's preferred value);
 * unranked/malformed entries sort last. */
function rankOf(entry: unknown): number {
  if (entry && typeof entry === "object") {
    const rank = (entry as Record<string, unknown>).rank;
    if (typeof rank === "number") return rank;
  }
  return 99;
}

/**
 * Pull the project's recommended apex IPv4 out of a Vercel domain-config JSON body
 * (`GET /v6/domains/{domain}/config?projectIdOrName=…`), if present. Per Vercel's
 * docs, `recommendedIPv4` is "recommended IPv4s for the domain, where rank=1 is the
 * preferred value(s)" — i.e. an array of `{ rank, value: string[] }`. We handle that
 * documented shape (rank-1 first) plus a few defensive fallbacks (bare string,
 * `{ value }`, or an `aValues` array) in case the shape drifts across API versions.
 * Returns the first valid IPv4, or `null` when none is present (caller then falls
 * back to env/default). Never throws.
 */
function extractRecommendedApexIp(body: Record<string, unknown>): string | null {
  const rec = body.recommendedIPv4;

  // Documented shape: array of `{ rank, value: string[] }`, rank=1 preferred.
  if (Array.isArray(rec)) {
    const ranked = [...rec].sort((a, b) => rankOf(a) - rankOf(b));
    for (const entry of ranked) {
      if (isIpv4(entry)) return entry; // array of bare strings
      if (entry && typeof entry === "object") {
        const value = (entry as Record<string, unknown>).value;
        if (isIpv4(value)) return value;
        if (Array.isArray(value)) {
          const hit = value.find(isIpv4);
          if (hit) return hit;
        }
      }
    }
  }

  // `recommendedIPv4` as a bare string.
  if (isIpv4(rec)) return rec;

  // `recommendedIPv4` as `{ value: string | string[] }`.
  if (rec && typeof rec === "object" && !Array.isArray(rec)) {
    const value = (rec as Record<string, unknown>).value;
    if (isIpv4(value)) return value;
    if (Array.isArray(value)) {
      const hit = value.find(isIpv4);
      if (hit) return hit;
    }
  }

  // `aValues` — array of A-record IPs the domain should point at.
  if (Array.isArray(body.aValues)) {
    const hit = body.aValues.find(isIpv4);
    if (hit) return hit;
  }

  return null;
}

/** Thrown for any non-2xx Vercel API response. `code` carries Vercel's error code
 * (e.g. "domain_already_in_use") when present, so callers can branch on it without
 * parsing message strings. */
export class VercelDomainError extends Error {
  code?: string;
  status?: number;
  constructor(message: string, opts?: { code?: string; status?: number }) {
    super(message);
    this.name = "VercelDomainError";
    this.code = opts?.code;
    this.status = opts?.status;
  }
}

interface VercelEnv {
  token: string;
  projectId: string;
}

/** Resolve + validate the two required env vars at call time. Throws a clear,
 * non-leaky error if either is missing rather than crashing module load. */
function getVercelEnv(): VercelEnv {
  const token = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!token || !projectId) {
    throw new VercelDomainError(
      "Custom domains aren't configured on this deployment yet.",
    );
  }
  return { token, projectId };
}

/** Our normalized shape for a Vercel project-domain response. */
export interface VercelDomainResult {
  name: string;
  verified: boolean;
  verification: DomainVerificationChallenge[];
}

async function vercelFetch(path: string, init?: RequestInit): Promise<Response> {
  const { token } = getVercelEnv();
  return fetch(`${VERCEL_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    // Domain state changes constantly server-side (DNS propagation); never cache.
    cache: "no-store",
  });
}

/** Defensively map Vercel's `verification` array into our typed challenge shape.
 * Vercel's documented per-challenge shape is `{ type, domain, value, reason }`
 * (their `domain` is the DNS record name to publish, NOT the domain being added) —
 * mapped here to our `{ type, name, value }`. If the shape ever differs (field
 * renamed, array missing), this logs and returns `[]` rather than throwing, so a
 * Vercel response-shape drift never crashes the add-domain flow. NOTE: this mapping
 * is unverified against a live Vercel API call — confirm against a real response in
 * the next phase / manual testing.
 */
function mapVerificationChallenges(raw: unknown): DomainVerificationChallenge[] {
  if (!Array.isArray(raw)) return [];
  const out: DomainVerificationChallenge[] = [];
  for (const entry of raw) {
    try {
      if (!entry || typeof entry !== "object") continue;
      const e = entry as Record<string, unknown>;
      const type = typeof e.type === "string" ? e.type.toUpperCase() : "";
      const name = typeof e.domain === "string" ? e.domain : typeof e.name === "string" ? e.name : "";
      const value = typeof e.value === "string" ? e.value : "";
      if (!type || !value) continue;
      if (type !== "TXT" && type !== "CNAME" && type !== "A") continue;
      out.push({ type, name, value });
    } catch (err) {
      console.error("[vercel/domains] failed to map a verification challenge entry", err);
    }
  }
  return out;
}

/** Parse a Vercel project-domain JSON body into our normalized shape. Defensive:
 * missing/renamed fields degrade rather than throw. */
function parseDomainResult(body: unknown, fallbackName: string): VercelDomainResult {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  return {
    name: typeof b.name === "string" ? b.name : fallbackName,
    verified: Boolean(b.verified),
    verification: mapVerificationChallenges(b.verification),
  };
}

async function throwForErrorResponse(res: Response): Promise<never> {
  let code: string | undefined;
  let message = `Vercel API error (${res.status})`;
  try {
    const body = (await res.json()) as { error?: { code?: string; message?: string } };
    code = body?.error?.code;
    if (body?.error?.message) message = body.error.message;
  } catch {
    /* non-JSON error body — keep the generic message */
  }
  throw new VercelDomainError(message, { code, status: res.status });
}

/**
 * Add a domain to the Vercel project. Throws `VercelDomainError` on failure — callers
 * should branch on `.code` (e.g. `"domain_already_in_use"`) to show a friendly message
 * rather than a generic one, and must never surface the raw message to end users.
 */
export async function addProjectDomain(domain: string): Promise<VercelDomainResult> {
  const { projectId } = getVercelEnv();
  const res = await vercelFetch(`/v10/projects/${projectId}/domains`, {
    method: "POST",
    body: JSON.stringify({ name: domain }),
  });
  if (!res.ok) await throwForErrorResponse(res);
  const body = await res.json().catch(() => ({}));
  return parseDomainResult(body, domain);
}

/**
 * Misconfiguration check for a domain already attached to the project — used by the
 * refresh/status check and the cron sweep to decide whether DNS still needs work.
 *
 * Also surfaces `recommendedApexIp`: the project-specific apex A-record IP Vercel
 * says this domain should point at, when the response carries it. Vercel assigns the
 * apex IP PER PROJECT/PLAN, so callers should feed this into `resolveApexIp` rather
 * than hardcoding a value. `null` when the response doesn't include a recommendation
 * (caller falls back to the env override / default).
 */
export async function getProjectDomainConfig(
  domain: string,
): Promise<{ misconfigured: boolean; recommendedApexIp: string | null }> {
  const { projectId } = getVercelEnv();
  // Domain config lives at the DOMAIN-level v6 endpoint (`/v6/domains/{domain}/config`),
  // NOT a project-scoped path — the previous `/v9/projects/{id}/domains/{domain}/config`
  // doesn't exist and 404'd, which is what made "Refresh status" error out. The project
  // is passed via `?projectIdOrName=` so Vercel scopes the recommended records to it.
  const res = await vercelFetch(
    `/v6/domains/${encodeURIComponent(domain)}/config?projectIdOrName=${encodeURIComponent(projectId)}`,
  );
  if (!res.ok) await throwForErrorResponse(res);
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  const recommendedApexIp = extractRecommendedApexIp(body);
  // One-time production confirmation of the real field name: log the raw config body
  // only when we COULDN'T find a recommended IP, so we can see which field Vercel
  // actually uses without spamming logs for the healthy path. No secrets/PII here —
  // this is public DNS config for a merchant-supplied domain.
  if (recommendedApexIp === null) {
    console.warn(
      "[vercel/domains] no recommended apex IP found in domain config; falling back to env/default",
      { domain, config: body },
    );
  }

  return { misconfigured: Boolean(body.misconfigured), recommendedApexIp };
}

/**
 * Current verification/state for a domain already attached to the project — used by
 * the refresh/status check and the cron sweep.
 */
export async function getProjectDomain(domain: string): Promise<VercelDomainResult> {
  const { projectId } = getVercelEnv();
  const res = await vercelFetch(`/v9/projects/${projectId}/domains/${encodeURIComponent(domain)}`);
  if (!res.ok) await throwForErrorResponse(res);
  const body = await res.json().catch(() => ({}));
  return parseDomainResult(body, domain);
}

/**
 * Remove a domain from the Vercel project. Idempotent: a 404 (already gone on
 * Vercel's side) is treated as success, not an error, so a merchant can always
 * detach a domain from our records even if it was already removed upstream.
 */
export async function removeProjectDomain(domain: string): Promise<void> {
  const { projectId } = getVercelEnv();
  const res = await vercelFetch(`/v9/projects/${projectId}/domains/${encodeURIComponent(domain)}`, {
    method: "DELETE",
  });
  if (res.ok || res.status === 404) return;
  await throwForErrorResponse(res);
}

/**
 * True if `domain` looks like an apex/root domain (no subdomain label), e.g.
 * `cooltshirts.com` → true, `shop.cooltshirts.com` → false. Drives whether we tell
 * the merchant to publish an A record (apex) or a CNAME (subdomain).
 *
 * MVP heuristic only: counts labels (`2` labels = apex). This does NOT correctly
 * handle multi-part public-suffix TLDs like `co.uk` (e.g. `cooltshirts.co.uk` would
 * be miscounted as having a subdomain). A full public-suffix-list lookup is out of
 * scope for this phase — flagged here, not over-engineered.
 */
export function isApexDomain(domain: string): boolean {
  const clean = domain.trim().toLowerCase();
  const labels = clean.split(".").filter(Boolean);
  return labels.length === 2;
}
