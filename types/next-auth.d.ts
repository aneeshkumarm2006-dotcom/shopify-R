import type { UserRole } from "./store";

/**
 * Augment NextAuth's `Session`/`JWT` with the merchant identity our `jwt` and
 * `session` callbacks stamp on at sign-in (see `lib/auth`). The token carries only
 * the immutable identity (`userId`, `role`); the *active store* is resolved from
 * `users.activeStoreId` in the DB per request (multi-store), so it is intentionally
 * NOT on the session/token — that keeps the DB the single source of truth and lets
 * the ownership guard authorize every store access in one place.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }

  /**
   * The Credentials `authorize` callback returns these extra fields so the `jwt`
   * callback can lift the resolved identity onto the token (the OAuth path derives
   * it from `provisionMerchant` instead).
   */
  interface User {
    role?: UserRole;
    userId?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    role?: UserRole;
  }
}
