"use server";

import { revalidatePath } from "next/cache";
import type { CustomDomain, DomainVerificationChallenge } from "@/types";
import {
  createPendingDomain,
  getDomainById,
  removeDomain,
  setPrimaryDomain,
  updateDomainVerification,
  getStore,
  recordEvent,
  DomainError,
} from "@/lib/data";
import { requireMerchantStoreId, assertNotImpersonating, getActorUserId } from "@/lib/auth";
import { isDbConfigured } from "@/lib/db";
import { APP_DOMAIN } from "@/lib/tenant/host";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  addProjectDomain,
  getProjectDomain,
  getProjectDomainConfig,
  removeProjectDomain,
  isApexDomain,
  resolveApexIp,
  VercelDomainError,
} from "@/lib/vercel/domains";
import { syncVerifiedDomainToEdgeConfig, removeDomainFromEdgeConfig } from "@/lib/vercel/edge-config";

/**
 * Per-store custom domain admin actions (Phase 2). `storeId` is ALWAYS resolved
 * server-side via `requireMerchantStoreId()` — never taken from client input — and
 * every domain-scoped op re-checks ownership (`getDomainById(storeId, domainId)`)
 * before mutating, so one merchant can never read/touch another's domain row
 * (IDOR guard). Mutating actions are blocked while impersonating (read-only).
 */

const DOMAIN_PATH = "/settings/domains";

/** Conservative domain-shape check: dot-separated labels of alphanumerics/hyphens,
 * 2+ labels, TLD-shaped tail (2+ alpha chars). Not a full RFC validator — good
 * enough to reject garbage before we ever hand it to the Vercel API. */
const DOMAIN_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

/** Trim, lowercase, strip an accidental scheme/path/trailing slash a merchant might
 * paste from a browser bar, and validate the result looks like a real domain. */
function normalizeDomainInput(raw: string): { ok: true; domain: string } | { ok: false; error: string } {
  let value = (raw ?? "").trim().toLowerCase();
  if (!value) return { ok: false, error: "Enter a domain." };
  value = value.replace(/^https?:\/\//, "");
  value = value.split("/")[0] ?? value; // drop any path
  value = value.split(":")[0] ?? value; // drop any port
  value = value.replace(/\.$/, ""); // trailing dot

  if (value.length > 253 || !DOMAIN_RE.test(value)) {
    return { ok: false, error: "Enter a valid domain, e.g. shop.example.com." };
  }
  return { ok: true, domain: value };
}

/** A merchant must never be able to claim the platform's own apex/wildcard domain. */
function isPlatformDomain(domain: string): boolean {
  const app = APP_DOMAIN.toLowerCase();
  return domain === app || domain.endsWith(`.${app}`);
}

/**
 * The full set of DNS records a merchant must publish for a domain to go live:
 *  - any ownership-verification challenges Vercel returned (TXT records — only present
 *    when the domain is contested / moving from another Vercel account), PLUS
 *  - the ROUTING record that actually points the domain at us. Vercel doesn't always
 *    return this in its `verification` array (when no ownership challenge is needed it
 *    comes back empty), so we always synthesize it ourselves from Vercel's standard
 *    targets: an `A` record to the apex IP for a root domain, a `CNAME` for a subdomain.
 *    Without this, a domain with no TXT challenge would show NO instructions at all.
 *
 * `apexIp` is the resolved apex A-record value (Vercel assigns it PER PROJECT, so it's
 * threaded in from the config response via `resolveApexIp` rather than hardcoded). It's
 * ignored on the CNAME (subdomain) path, whose target `cname.vercel-dns.com` is stable.
 */
function buildDnsInstructions(
  domain: string,
  apex: boolean,
  vercelChallenges: DomainVerificationChallenge[],
  apexIp: string,
): DomainVerificationChallenge[] {
  const routing: DomainVerificationChallenge = apex
    ? { type: "A", name: "@", value: apexIp }
    : {
        type: "CNAME",
        // host part (everything before the registrable domain), e.g. "shop" for
        // shop.example.com — what the merchant enters as the record name.
        name: domain.split(".").slice(0, -2).join(".") || domain,
        value: "cname.vercel-dns.com",
      };
  return [...vercelChallenges, routing];
}

/** Friendly, non-leaky message for a failed Vercel call — never echoes raw Vercel
 * error text to the client. */
function friendlyVercelError(err: unknown): string {
  if (err instanceof VercelDomainError) {
    if (err.code === "domain_already_in_use" || err.status === 409) {
      return "This domain is already registered on Vercel — either to another project, or from an earlier attempt. Remove it from the Vercel dashboard first, then try again.";
    }
    if (err.status === 401 || err.status === 403) {
      return "Custom domains aren't available right now. Please try again later.";
    }
  }
  return "Couldn't connect that domain right now. Please try again.";
}

export async function addDomainAction(
  input: { domain: string },
): Promise<{ ok: true; domain: CustomDomain } | { ok: false; error: string }> {
  const storeId = await requireMerchantStoreId();
  try {
    await assertNotImpersonating();
  } catch {
    return { ok: false, error: "Action unavailable while impersonating." };
  }

  const { allowed: addAllowed } = await checkRateLimit({
    key: `domain-add:${storeId}`,
    limit: 5,
    windowSeconds: 3600,
  });
  if (!addAllowed) {
    return { ok: false, error: "Too many domain additions. Please wait before trying again." };
  }

  const normalized = normalizeDomainInput(input?.domain ?? "");
  if (!normalized.ok) return normalized;
  const { domain } = normalized;

  if (isPlatformDomain(domain)) {
    return { ok: false, error: "You can't connect our platform's own domain." };
  }

  // Guard BEFORE touching Vercel: `addProjectDomain` registers the domain on the
  // Vercel project, but if the subsequent DB write can't run (no database) the domain
  // is left orphaned on Vercel — registered there yet invisible to the app, unable to
  // be removed via the UI. Refuse up front when there's no DB so we never register a
  // domain we can't also persist.
  if (!isDbConfigured()) {
    return { ok: false, error: "Custom domains need a database connection." };
  }

  let vercelResult;
  try {
    vercelResult = await addProjectDomain(domain);
  } catch (err) {
    console.error("[domains] addProjectDomain failed", { domain, err });
    return { ok: false, error: friendlyVercelError(err) };
  }

  let created: CustomDomain;
  try {
    created = await createPendingDomain(storeId, domain, isApexDomain(domain), (await getActorUserId()) ?? undefined);
  } catch (err) {
    // The Vercel registration above already succeeded; if we can't record the domain
    // in our DB, roll it back off the Vercel project so it doesn't orphan. Best-effort:
    // a failed rollback is logged (and the cron/manual cleanup can catch it), but we
    // still surface the original save error to the merchant.
    try {
      await removeProjectDomain(domain);
    } catch (rollbackErr) {
      console.error("[domains] rollback removeProjectDomain failed after DB save error", {
        domain,
        rollbackErr,
      });
    }
    const message = err instanceof DomainError ? err.message : "Couldn't save this domain.";
    return { ok: false, error: message };
  }

  // Don't trust Vercel's `verified` flag alone — it only means the domain was accepted
  // onto the project (no ownership challenge), NOT that DNS is pointed and serving. The
  // real "is it live" signal is the config check's `misconfigured`. A freshly added
  // domain almost always has DNS not-yet-pointed → "pending" until a refresh/cron (or
  // this check, if the merchant pre-pointed DNS) confirms it's correctly configured.
  let misconfigured = true;
  let recommendedApexIp: string | null = null;
  try {
    const config = await getProjectDomainConfig(domain);
    misconfigured = config.misconfigured;
    // Reuse the apex IP Vercel recommends in this same config response — no extra
    // round-trip. Falls back to env/default inside resolveApexIp when it's null.
    recommendedApexIp = config.recommendedApexIp;
  } catch {
    // Can't check → assume not-yet-configured (pending). Safer than claiming verified;
    // the refresh button / cron sweep will promote it once DNS actually resolves.
    misconfigured = true;
  }
  const live = vercelResult.verified && !misconfigured;

  const updated = await updateDomainVerification(created._id, {
    verificationStatus: live ? "verified" : "pending",
    verificationDetails: buildDnsInstructions(
      domain,
      isApexDomain(domain),
      vercelResult.verification,
      resolveApexIp(recommendedApexIp),
    ),
    sslStatus: live ? "issued" : "pending",
  });

  const actorUserId = await getActorUserId();
  await recordEvent({
    type: "domain.added",
    storeId,
    actorUserId,
    target: { kind: "store", id: storeId },
    metadata: { domain },
  });

  revalidatePath(DOMAIN_PATH);
  return { ok: true, domain: updated ?? created };
}

export async function removeDomainAction(domainId: string): Promise<{ ok: boolean; error?: string }> {
  const storeId = await requireMerchantStoreId();
  try {
    await assertNotImpersonating();
  } catch {
    return { ok: false, error: "Action unavailable while impersonating." };
  }

  const existing = await getDomainById(storeId, domainId);
  if (!existing) return { ok: false, error: "Domain not found." };

  try {
    await removeProjectDomain(existing.domain);
  } catch (err) {
    // Don't block the DB removal on a Vercel-side hiccup — the merchant should still
    // be able to detach the domain from our records. This can leave a stale
    // registration on Vercel's side; logged so it's visible, not silently swallowed.
    console.error("[domains] removeProjectDomain failed (continuing with DB removal)", {
      domain: existing.domain,
      err,
    });
  }

  try {
    await removeDomainFromEdgeConfig(existing.domain);
  } catch (err) {
    // Same non-blocking posture as the Vercel removal above — the merchant should
    // still be able to detach the domain from our records even if the routing-cache
    // delete fails. This can leave a stale entry that still resolves at the edge
    // until manually corrected; logged so it's visible, not silently swallowed.
    console.error("[domains] removeDomainFromEdgeConfig failed (continuing with DB removal)", {
      domain: existing.domain,
      err,
    });
  }

  const removed = await removeDomain(storeId, domainId);
  if (!removed) return { ok: false, error: "Domain not found." };

  await recordEvent({
    type: "domain.removed",
    storeId,
    actorUserId: await getActorUserId(),
    target: { kind: "store", id: storeId },
    metadata: { domain: existing.domain },
  });

  revalidatePath(DOMAIN_PATH);
  return { ok: true };
}

export async function setPrimaryDomainAction(domainId: string): Promise<{ ok: boolean; error?: string }> {
  const storeId = await requireMerchantStoreId();
  try {
    await assertNotImpersonating();
  } catch {
    return { ok: false, error: "Action unavailable while impersonating." };
  }

  let updated: CustomDomain;
  try {
    updated = await setPrimaryDomain(storeId, domainId);
  } catch (err) {
    const message = err instanceof DomainError ? err.message : "Couldn't set this domain as primary.";
    return { ok: false, error: message };
  }

  await recordEvent({
    type: "domain.set_primary",
    storeId,
    actorUserId: await getActorUserId(),
    target: { kind: "store", id: storeId },
    metadata: { domain: updated.domain },
  });

  revalidatePath(DOMAIN_PATH);
  return { ok: true };
}

export async function refreshDomainStatusAction(
  domainId: string,
): Promise<{ ok: true; domain: CustomDomain } | { ok: false; error: string }> {
  const storeId = await requireMerchantStoreId();

  const existing = await getDomainById(storeId, domainId);
  if (!existing) return { ok: false, error: "Domain not found." };

  let config: { misconfigured: boolean; recommendedApexIp: string | null };
  let info;
  try {
    [config, info] = await Promise.all([
      getProjectDomainConfig(existing.domain),
      getProjectDomain(existing.domain),
    ]);
  } catch (err) {
    console.error("[domains] refresh status failed", { domain: existing.domain, err });
    return { ok: false, error: "Couldn't check this domain's status right now." };
  }

  const wasVerified = existing.verificationStatus === "verified";
  const nowVerified = info.verified && !config.misconfigured;

  const verificationStatus = nowVerified ? "verified" : config.misconfigured ? "failed" : "pending";
  const errorMessage = config.misconfigured
    ? "DNS records look misconfigured. Double-check the records below."
    : null;

  const updated = await updateDomainVerification(existing._id, {
    verificationStatus,
    verificationDetails: buildDnsInstructions(
      existing.domain,
      existing.isApex,
      info.verification,
      resolveApexIp(config.recommendedApexIp),
    ),
    sslStatus: nowVerified ? "issued" : "pending",
    errorMessage,
  });
  if (!updated) return { ok: false, error: "Domain not found." };

  const actorUserId = await getActorUserId();
  if (!wasVerified && verificationStatus === "verified") {
    const store = await getStore(storeId);
    if (store?.subdomain) {
      try {
        await syncVerifiedDomainToEdgeConfig(existing.domain, store.subdomain);
      } catch (err) {
        // Don't fail the whole status-refresh on a routing-cache write hiccup — the
        // domain is already marked verified in Mongo; only the edge fast-path cache
        // is degraded until the next successful sync (cron sweep will retry it).
        console.error("[domains] syncVerifiedDomainToEdgeConfig failed (continuing)", {
          domain: existing.domain,
          err,
        });
      }
    }
    await recordEvent({
      type: "domain.verified",
      storeId,
      actorUserId,
      target: { kind: "store", id: storeId },
      metadata: { domain: existing.domain },
    });
  } else if (verificationStatus === "failed") {
    await recordEvent({
      type: "domain.failed",
      storeId,
      actorUserId,
      target: { kind: "store", id: storeId },
      metadata: { domain: existing.domain, reason: errorMessage },
    });
  }

  revalidatePath(DOMAIN_PATH);
  return { ok: true, domain: updated };
}
