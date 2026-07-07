import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { dbConnect } from "@/lib/db/connect";
import { LoginCodeModel } from "@/lib/db/models";
import { isDbConfigured } from "@/lib/db";

/**
 * Passwordless storefront sign-in codes (Shopify's current customer-accounts model —
 * a 6-digit one-time code emailed to the shopper, no password). The plaintext code is
 * returned to the caller ONCE (to email) and only its HMAC is stored, keyed per
 * `(storeId, email)` with a short TTL and an attempt cap.
 */

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

/** Resolve the HMAC key; fail closed in production (mirrors lib/customer/token.ts). */
function secret(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXTAUTH_SECRET is required to sign login codes (fail closed).");
  }
  return "offshelf-dev-customer-session-secret";
}

const hashCode = (storeId: string, email: string, code: string): string =>
  createHmac("sha256", secret()).update(`${storeId}:${email}:${code}`).digest("hex");

const norm = (email: string) => email.trim().toLowerCase();

/**
 * Mint + store a fresh 6-digit code for `(storeId, email)`, replacing any prior code.
 * Returns the plaintext code so the caller can email it (never stored raw). CSPRNG —
 * `randomInt` — so codes can't be predicted.
 */
export async function issueLoginCode(storeId: string, email: string): Promise<string | null> {
  if (!isDbConfigured()) return null;
  await dbConnect();
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const lower = norm(email);
  await LoginCodeModel.findOneAndUpdate(
    { storeId, email: lower },
    {
      storeId,
      email: lower,
      codeHash: hashCode(storeId, lower, code),
      attempts: 0,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return code;
}

/**
 * Verify a submitted code for `(storeId, email)`. Constant-time compare, expiry check,
 * and an attempt cap (each wrong guess increments; too many invalidates the code).
 * On success the code is consumed (deleted) so it can't be replayed.
 */
export async function verifyLoginCode(
  storeId: string,
  email: string,
  code: string,
): Promise<{ ok: boolean; reason?: "expired" | "too_many" | "invalid" }> {
  if (!isDbConfigured()) return { ok: false, reason: "invalid" };
  await dbConnect();
  const lower = norm(email);
  const rec = await LoginCodeModel.findOne({ storeId, email: lower }).lean<{
    codeHash: string;
    attempts: number;
    expiresAt: Date;
  } | null>();
  if (!rec) return { ok: false, reason: "invalid" };
  if (new Date(rec.expiresAt).getTime() < Date.now()) {
    await LoginCodeModel.deleteOne({ storeId, email: lower });
    return { ok: false, reason: "expired" };
  }
  if (rec.attempts >= MAX_ATTEMPTS) {
    await LoginCodeModel.deleteOne({ storeId, email: lower });
    return { ok: false, reason: "too_many" };
  }

  const expected = Buffer.from(rec.codeHash);
  const actual = Buffer.from(hashCode(storeId, lower, code.trim()));
  const match = expected.length === actual.length && timingSafeEqual(expected, actual);
  if (!match) {
    await LoginCodeModel.updateOne({ storeId, email: lower }, { $inc: { attempts: 1 } });
    return { ok: false, reason: "invalid" };
  }

  await LoginCodeModel.deleteOne({ storeId, email: lower }); // consume — single use
  return { ok: true };
}
