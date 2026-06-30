"use server";

import { revalidatePath } from "next/cache";
import type { CustomDomain } from "@/types";
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
import { APP_DOMAIN } from "@/lib/tenant/host";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  addProjectDomain,
  getProjectDomain,
  getProjectDomainConfig,
  removeProjectDomain,
  isApexDomain,
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

/** Friendly, non-leaky message for a failed Vercel call — never echoes raw Vercel
 * error text to the client. */
function friendlyVercelError(err: unknown): string {
  if (err instanceof VercelDomainError) {
    if (err.code === "domain_already_in_use" || err.status === 409) {
      return "This domain is already connected to another project. Remove it there first, or use a different domain.";
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
    const message = err instanceof DomainError ? err.message : "Couldn't save this domain.";
    return { ok: false, error: message };
  }

  // Reflect whatever Vercel told us immediately rather than leaving it pending.
  const updated = await updateDomainVerification(created._id, {
    verificationStatus: vercelResult.verified ? "verified" : "pending",
    verificationDetails: vercelResult.verification,
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

  let config: { misconfigured: boolean };
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
    verificationDetails: info.verification,
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
