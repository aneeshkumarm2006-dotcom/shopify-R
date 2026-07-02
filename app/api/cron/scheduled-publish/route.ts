import { NextResponse } from "next/server";
import { checkCronAuth } from "@/lib/cron-auth";
import { runScheduledPublishes } from "@/lib/data";

/**
 * Scheduled-publish cron (Phase 6). A scheduler hits this on an interval; it publishes
 * every draft store whose scheduled time has passed. Protected by the shared
 * `CRON_SECRET` (Bearer); disabled (503) when the secret is unset.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const denied = checkCronAuth(req);
  if (denied) return NextResponse.json({ ok: false, error: denied.error }, { status: denied.status });
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
