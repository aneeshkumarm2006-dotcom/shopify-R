import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Operator impersonation cookie (read-only v1). A signed, time-boxed, operator-bound
 * token naming a single target store. It is the ONLY vehicle that lets
 * `getMerchantContext` return a store the signed-in user doesn't own — and only when
 * that user is a `platform_admin` (the role gate lives in `getMerchantContext`, not
 * here). The token never touches `users.activeStoreId`, so a merchant's own state is
 * untouched and the ownership invariant for normal merchants is preserved.
 *
 * Signed with HMAC-SHA256 over `NEXTAUTH_SECRET`. No new dependency; runs in the Node
 * runtime where the admin guards already live. `set`/`delete` are only legal inside
 * server actions/route handlers (start/stop/sign-out); `read` is safe anywhere.
 */

const COOKIE = "offshelf_imp";
const SECRET = process.env.NEXTAUTH_SECRET ?? "";
/** 30-minute hard cap, re-checked every request. No silent renewal. */
export const IMPERSONATION_TTL_SECONDS = 30 * 60;

interface ImpersonationPayload {
  storeId: string;
  operatorId: string;
  exp: number; // epoch ms
}

export interface ActiveImpersonation {
  storeId: string;
  operatorId: string;
}

function sign(body: string): string {
  return createHmac("sha256", SECRET).update(body).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Mint + set the impersonation cookie (call only from a server action). */
export async function mintImpersonation(storeId: string, operatorId: string): Promise<void> {
  if (!SECRET) return;
  const payload: ImpersonationPayload = {
    storeId,
    operatorId,
    exp: Date.now() + IMPERSONATION_TTL_SECONDS * 1000,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const token = `${body}.${sign(body)}`;
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: IMPERSONATION_TTL_SECONDS,
  });
}

/** Verify the cookie (signature + expiry) and return the active impersonation, or null. */
export async function readImpersonation(): Promise<ActiveImpersonation | null> {
  if (!SECRET) return null;
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [body, sig] = raw.split(".");
  if (!body || !sig || !safeEqual(sig, sign(body))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as ImpersonationPayload;
    if (!payload.storeId || !payload.operatorId || typeof payload.exp !== "number") return null;
    if (payload.exp < Date.now()) return null; // expired → inert
    return { storeId: payload.storeId, operatorId: payload.operatorId };
  } catch {
    return null;
  }
}

/** Clear the impersonation cookie (call from stop + sign-out). */
export async function clearImpersonation(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/** Thrown by mutating actions when blocked because an operator is impersonating. */
export class ImpersonationReadOnlyError extends Error {
  constructor() {
    super("You're viewing this store as an operator (read-only). Exit impersonation to make changes.");
    this.name = "ImpersonationReadOnlyError";
  }
}
