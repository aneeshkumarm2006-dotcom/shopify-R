import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "crypto";
import { promisify } from "util";

/**
 * Password hashing for email+password sign-in (PRD §7.1) using Node's built-in
 * `scrypt` — a memory-hard KDF — so we add no third-party dependency. Each hash is
 * self-describing: `scrypt$<saltHex>$<keyHex>`, carrying its own random salt so
 * verification needs nothing but the stored string. Verification is constant-time
 * (`timingSafeEqual`) to avoid leaking the hash via timing.
 *
 * Server-only (imported from the auth/provisioning seams) — never bundle into a
 * Client Component.
 */

const KEY_LEN = 64;
const SCHEME = "scrypt";

const scrypt = promisify(scryptCb);

/** Hash a plaintext password into a storable `scrypt$salt$key` string. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = (await scrypt(password, salt, KEY_LEN)) as Buffer;
  return `${SCHEME}$${salt.toString("hex")}$${key.toString("hex")}`;
}

/** Verify a plaintext password against a stored hash. Never throws — returns false. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [scheme, saltHex, keyHex] = stored.split("$");
    if (scheme !== SCHEME || !saltHex || !keyHex) return false;
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(keyHex, "hex");
    const actual = (await scrypt(password, salt, expected.length)) as Buffer;
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
