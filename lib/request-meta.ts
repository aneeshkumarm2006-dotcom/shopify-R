import { headers } from "next/headers";
import { createHash } from "node:crypto";

/**
 * Best-effort client IP for rate-limit keys. Behind Vercel the leftmost
 * `x-forwarded-for` entry is the real client; falls back to `x-real-ip` and a constant
 * so a missing header still yields a stable (shared) bucket rather than throwing.
 */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || "unknown";
  return h.get("x-real-ip") ?? "unknown";
}

/** Short, non-reversible digest so PII (emails) never lands in rate-limit keys/logs. */
export function keyHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}
