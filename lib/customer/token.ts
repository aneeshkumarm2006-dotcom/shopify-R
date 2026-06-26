import { createHmac, timingSafeEqual } from "crypto";

/**
 * Pure token sign/verify for the storefront customer session (Phase 3). No
 * `next/headers` here, so it's unit-testable in isolation; `session.ts` layers the
 * cookie read/write on top. Token shape: `base64url(customerId:storeId:exp).hmac`,
 * HMAC-SHA256 over the app secret. The `storeId` is bound INTO the signature, so a
 * token can't be replayed against another tenant (PRD §9).
 */

const TTL_DAYS = 30;
const SECRET = process.env.NEXTAUTH_SECRET || "offshelf-dev-customer-session-secret";

const b64url = (s: string) => Buffer.from(s, "utf8").toString("base64url");
const unb64url = (s: string) => Buffer.from(s, "base64url").toString("utf8");

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("hex");
}

/** Mint a signed token binding a customer to a store, valid for `TTL_DAYS`. */
export function createCustomerToken(
  customerId: string,
  storeId: string,
  nowMs: number = Date.now(),
): string {
  const exp = nowMs + TTL_DAYS * 24 * 60 * 60 * 1000;
  const payload = `${customerId}:${storeId}:${exp}`;
  return `${b64url(payload)}.${sign(payload)}`;
}

/**
 * Parse + verify a token: checks the HMAC (constant-time) and the expiry. Returns the
 * bound `{ customerId, storeId }` or null for anything malformed, tampered, or expired.
 */
export function parseCustomerToken(
  token: string | undefined,
  nowMs: number = Date.now(),
): { customerId: string; storeId: string } | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const encoded = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  let payload: string;
  try {
    payload = unb64url(encoded);
  } catch {
    return null;
  }
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const [customerId, storeId, expStr] = payload.split(":");
  if (!customerId || !storeId || !expStr) return null;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < nowMs) return null;
  return { customerId, storeId };
}

export const CUSTOMER_TTL_DAYS = TTL_DAYS;
