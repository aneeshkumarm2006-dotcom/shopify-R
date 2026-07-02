import { NextResponse } from "next/server";
import { checkCronAuth } from "@/lib/cron-auth";
import { listPendingDomainsForSweep, updateDomainVerification, getStore } from "@/lib/data";
import { getProjectDomain, getProjectDomainConfig } from "@/lib/vercel/domains";
import { syncVerifiedDomainToEdgeConfig } from "@/lib/vercel/edge-config";

/**
 * Domain verification sweep cron (Phase 2). A scheduler hits this on an interval; it
 * re-checks every `pending` custom domain against the Vercel API and updates our DB
 * record accordingly. Protected by the shared `CRON_SECRET` (Bearer); disabled (503)
 * when the secret is unset. Best-effort per domain — one failure never aborts the
 * sweep (mirrors `runScheduledPublishes`).
 *
 * Domains stuck `pending` for more than 7 days are marked `failed` with a clear
 * "DNS verification timed out" message rather than polling forever.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SWEEP_THRESHOLD_MINUTES = 15;
const TIMEOUT_DAYS = 7;
const TIMEOUT_MS = TIMEOUT_DAYS * 24 * 60 * 60 * 1000;

export async function GET(req: Request): Promise<NextResponse> {
  const denied = checkCronAuth(req);
  if (denied) return NextResponse.json({ ok: false, error: denied.error }, { status: denied.status });

  try {
    const result = await runDomainVerifySweep();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "sweep failed" },
      { status: 500 },
    );
  }
}

async function runDomainVerifySweep(): Promise<{ checked: number; verified: number; failed: number }> {
  const pending = await listPendingDomainsForSweep(SWEEP_THRESHOLD_MINUTES);

  let checked = 0;
  let verified = 0;
  let failed = 0;

  // storeId -> subdomain, memoized so we don't refetch the store per-domain in the
  // (common) case a single store has multiple pending domains.
  const subdomainCache = new Map<string, string | null>();

  for (const domain of pending) {
    checked++;
    try {
      const createdAtMs = domain.createdAt ? new Date(domain.createdAt).getTime() : Date.now();
      if (Date.now() - createdAtMs > TIMEOUT_MS) {
        await updateDomainVerification(domain._id, {
          verificationStatus: "failed",
          errorMessage:
            "DNS verification timed out after 7 days — please re-check your DNS records and try again.",
        });
        failed++;
        continue;
      }

      const [config, info] = await Promise.all([
        getProjectDomainConfig(domain.domain),
        getProjectDomain(domain.domain),
      ]);

      const nowVerified = info.verified && !config.misconfigured;
      const verificationStatus = nowVerified ? "verified" : config.misconfigured ? "failed" : "pending";
      const errorMessage = config.misconfigured
        ? "DNS records look misconfigured. Double-check the records below."
        : null;

      await updateDomainVerification(domain._id, {
        verificationStatus,
        verificationDetails: info.verification,
        sslStatus: nowVerified ? "issued" : "pending",
        errorMessage,
      });

      if (verificationStatus === "verified") {
        verified++;
        let subdomain = subdomainCache.get(domain.storeId);
        if (subdomain === undefined) {
          const store = await getStore(domain.storeId);
          subdomain = store?.subdomain ?? null;
          subdomainCache.set(domain.storeId, subdomain);
        }
        if (subdomain) {
          await syncVerifiedDomainToEdgeConfig(domain.domain, subdomain);
        }
      } else if (verificationStatus === "failed") {
        failed++;
      }
    } catch (err) {
      // Best-effort: one domain's API hiccup never aborts the rest of the sweep.
      console.error("[domain-verify-sweep] failed for domain", { domainId: domain._id, err });
    }
  }

  return { checked, verified, failed };
}
