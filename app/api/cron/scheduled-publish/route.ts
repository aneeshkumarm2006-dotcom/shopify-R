import { NextResponse } from "next/server";
import { runScheduledPublishes } from "@/lib/data";

/**
 * Scheduled-publish cron (Phase 6). A scheduler hits this on an interval; it publishes
 * every draft store whose scheduled time has passed. Protected by the shared
 * `CRON_SECRET` (Bearer); disabled (503) when the secret is unset.
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
  try {
    const result = await runScheduledPublishes();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "sweep failed" },
      { status: 500 },
    );
  }
}
