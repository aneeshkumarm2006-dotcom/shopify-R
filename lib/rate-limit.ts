import { dbConnect } from "./db/connect";
import { RateLimitModel } from "./db/models/rate-limit";

/**
 * DB-backed fixed-window rate limiter using MongoDB as the counter store.
 *
 * Design:
 *  - A single `findOneAndUpdate` with `$inc` + upsert atomically creates or
 *    increments the counter for the current window — no separate read step, no
 *    race condition.
 *  - `_id` is `${key}:${windowStart}` where `windowStart` is
 *    `Math.floor(Date.now() / (windowSeconds * 1000))`.  Each new time window
 *    produces a fresh document automatically.
 *  - `$setOnInsert` writes `expiresAt` only when creating a new document, so
 *    subsequent increments never overwrite it.
 *  - MongoDB's TTL index on `expiresAt` (expireAfterSeconds: 0) deletes the
 *    document once the window ends — no cron, no manual cleanup.
 *
 * Fail-open policy: if the DB call itself fails (e.g. transient connection
 * error) the function returns `{ allowed: true, remaining: -1 }` rather than
 * rejecting the request.  This matches the "prefer availability over strict
 * enforcement for infrastructure faults" tradeoff appropriate for soft limits
 * (Vercel API quota protection), while still being explicit about the
 * degraded state in the return value so callers can log it if they choose.
 */
export async function checkRateLimit(opts: {
  key: string;         // e.g. "domain-add:store_abc"
  limit: number;       // max requests in the window
  windowSeconds: number; // e.g. 3600 for 1 hour
  /**
   * Security-sensitive limits (login, code-guessing oracles) should FAIL CLOSED: if the
   * counter store is unreachable, deny rather than let an attacker bypass throttling by
   * inducing DB pressure. Defaults to false (fail open) for soft infra-quota limits.
   */
  failClosed?: boolean;
}): Promise<{ allowed: boolean; remaining: number }> {
  const { key, limit, windowSeconds, failClosed = false } = opts;

  const windowStart = Math.floor(Date.now() / (windowSeconds * 1000));
  const docId = `${key}:${windowStart}`;
  const windowEnd = new Date((windowStart + 1) * windowSeconds * 1000);

  try {
    await dbConnect();

    const doc = await RateLimitModel.findByIdAndUpdate(
      docId,
      {
        $inc: { count: 1 },
        $setOnInsert: {
          key,
          expiresAt: windowEnd,
        },
      },
      {
        upsert: true,
        new: true,           // return the post-update document
        setDefaultsOnInsert: true,
      },
    ).lean() as { count: number } | null;

    const count = (doc as { count: number } | null)?.count ?? 1;

    if (count > limit) {
      return { allowed: false, remaining: 0 };
    }
    return { allowed: true, remaining: Math.max(0, limit - count) };
  } catch (err) {
    // Infrastructure fault. Security-sensitive callers (`failClosed`) deny so throttling
    // can't be bypassed by inducing DB pressure; soft infra-quota limits fail open so a
    // transient DB blip doesn't block legitimate requests. `remaining: -1` flags the
    // degraded state either way.
    console.error(
      `[rate-limit] counter update failed — failing ${failClosed ? "closed" : "open"}`,
      { key, err },
    );
    return { allowed: !failClosed, remaining: -1 };
  }
}
