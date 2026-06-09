import type { UserRole } from "./store";

/**
 * Augment NextAuth's `Session`/`JWT` with the merchant identity our `jwt` and
 * `session` callbacks stamp on at sign-in (see `lib/auth`). This is what lets
 * server guards read `session.user.storeId` in a typed way.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      storeId: string;
      role: UserRole;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    storeId?: string;
    role?: UserRole;
  }
}
