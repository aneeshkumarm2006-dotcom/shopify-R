import { NextResponse } from "next/server";
import { listDomainsForStore } from "@/lib/data";
import { requireMerchantStoreId } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Thin read-only poll endpoint for the domains admin UI (client-side polling while a
 * domain is pending). The store is resolved server-side from the session via
 * `requireMerchantStoreId()` — a client can never pass a `storeId` to read another
 * tenant's domains. No Vercel calls here; `refreshDomainStatusAction` does the actual
 * Vercel-backed status check. This route just reflects current DB state.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const storeId = await requireMerchantStoreId();

    const { allowed: pollAllowed } = await checkRateLimit({
      key: `domain-status:${storeId}`,
      limit: 30,
      windowSeconds: 300,
    });
    if (!pollAllowed) {
      return NextResponse.json({ ok: false, error: "Too many requests." }, { status: 429 });
    }

    const domains = await listDomainsForStore(storeId);
    return NextResponse.json({ ok: true, domains });
  } catch (err) {
    // `requireMerchantStoreId()` calls `redirect()` (next/navigation) when there's no
    // usable session/store — that throws a special NEXT_REDIRECT-digest error which
    // must propagate, not be swallowed into a JSON 500 (this is a fetch()-polled
    // route, so the redirect itself won't be followed by the browser, but the caller
    // gets a 307 instead of a misleading 500 — and a redirect digest must never be
    // caught-and-discarded, since some Next versions rely on it bubbling for tracing).
    if (
      err &&
      typeof err === "object" &&
      "digest" in err &&
      typeof (err as { digest?: unknown }).digest === "string" &&
      (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")
    ) {
      throw err;
    }
    console.error("[domains/status] failed", err);
    return NextResponse.json({ ok: false, error: "Couldn't load domains." }, { status: 500 });
  }
}
