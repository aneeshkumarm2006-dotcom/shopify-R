import { NextResponse } from "next/server";
import { getStoreBySubdomain, recordPageview } from "@/lib/data";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Storefront pageview beacon (operator visitor analytics). The `<TrackPageview>`
 * client beacon POSTs `{ subdomain, path, sessionId, ref }`; we resolve the store by
 * subdomain server-side (so a bogus client storeId can't be injected) and record a
 * pageview for LIVE stores only. Best-effort: always 200/`{ok}` so the beacon never
 * surfaces an error to a shopper. Privacy: stores a random session id + path, no IP.
 */
export const runtime = "nodejs";

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      subdomain?: string;
      path?: string;
      sessionId?: string;
      ref?: string;
    };
    const subdomain = typeof body.subdomain === "string" ? body.subdomain.trim().toLowerCase() : "";
    if (!subdomain) return NextResponse.json({ ok: false });

    // Throttle per client IP + store so this unauthenticated beacon can't be looped to
    // flood a store's analytics / bloat the pageviews collection. Fails open (soft
    // limit): a DB blip shouldn't drop legitimate analytics.
    const ip = (req.headers.get("x-forwarded-for")?.split(",")[0] ?? "").trim() || "unknown";
    const { allowed } = await checkRateLimit({
      key: `track:${subdomain}:${ip}`,
      limit: 120,
      windowSeconds: 60,
    });
    if (!allowed) return NextResponse.json({ ok: false });

    const store = await getStoreBySubdomain(subdomain);
    if (!store || store.status !== "live") return NextResponse.json({ ok: false });

    await recordPageview({
      storeId: store._id,
      sessionId: body.sessionId ?? null,
      path: body.path ?? "/",
      ref: body.ref ?? null,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
