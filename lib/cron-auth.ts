import { timingSafeEqual } from "node:crypto";

/**
 * Shared bearer-secret check for the cron routes. Returns a NextResponse-ready status:
 *   - 503 when `CRON_SECRET` is unset (endpoint disabled — never accidentally open)
 *   - 401 when the Authorization header is missing/wrong
 *   - null when the request is authorized (caller proceeds)
 *
 * The comparison is constant-time (`timingSafeEqual` over equal-length buffers) so the
 * secret can't be recovered via a timing side channel.
 */
export function checkCronAuth(req: Request): { status: number; error: string } | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) return { status: 503, error: "cron disabled (no CRON_SECRET)" };

  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { status: 401, error: "unauthorized" };
  }
  return null;
}
