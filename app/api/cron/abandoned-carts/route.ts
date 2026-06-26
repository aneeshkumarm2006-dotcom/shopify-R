import { NextResponse } from "next/server";
import { runAbandonedCartRecovery } from "@/lib/data";

/**
 * Abandoned-cart recovery cron (Phase 5). A scheduler (Vercel Cron, GitHub Actions,
 * any external pinger) hits this on an interval; it sweeps stale carts across all
 * stores and sends recovery emails. Protected by a shared secret: the caller must send
 * `Authorization: Bearer $CRON_SECRET`. When `CRON_SECRET` is unset the endpoint is
 * disabled (503) so it can't be triggered by accident in a misconfigured deploy.
 *
 * Tunable via query: `?hours=24&limit=100`.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "cron disabled (no CRON_SECRET)" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const hours = clamp(Number(url.searchParams.get("hours")) || 24, 1, 720);
  const limit = clamp(Number(url.searchParams.get("limit")) || 100, 1, 500);

  try {
    const result = await runAbandonedCartRecovery(hours, limit);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "sweep failed" },
      { status: 500 },
    );
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, Math.floor(n)));
}
