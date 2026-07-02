import NextAuth, { type Session } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { redirect, notFound } from "next/navigation";
import { resolveActiveStore } from "@/lib/data/account";
import { getStore } from "@/lib/data/store";
import { recordEvent } from "@/lib/data/events";
import { MOCK_STORE_ID } from "@/lib/data/mocks";
import { isDbConfigured } from "@/lib/db";
import { provisionMerchant, authenticateCredentials } from "./provision";
import { readImpersonation, ImpersonationReadOnlyError } from "./impersonation";
import { getStoreRole } from "@/lib/data/staff";
import { roleHasPermission } from "./permissions";
import type { Permission, StoreRole } from "@/types";

export { ImpersonationReadOnlyError } from "./impersonation";
export * from "./permissions";

/** Thrown when the signed-in user's role lacks the permission a server action needs. */
export class PermissionError extends Error {
  constructor(public permission: Permission) {
    super("You don't have permission to do that.");
    this.name = "PermissionError";
  }
}

/**
 * Real auth (TODO Stage 7, PRD §6.1 / §7.1) — NextAuth (Auth.js v5) with a single
 * Google OAuth provider and a stateless **JWT** session (no DB session table; the
 * merchant's identity lives in the signed token). On the *first* sign-in the `jwt`
 * callback provisions the user + primary draft store + subscription (see `./provision`)
 * and stamps the immutable identity (`userId`, `role`) into the token. The *active*
 * store is deliberately NOT in the token — a user owns many stores and can switch, so
 * the active store is resolved (and ownership-verified) from the DB per request in
 * `getMerchantContext` → `resolveActiveStore`.
 *
 * ### Graceful degradation
 * The whole system is gated on `isAuthConfigured()`. With the OAuth/secret env
 * vars unset (Part A, or a teammate running on mock data) the provider list is
 * empty and the route guards fall back to the demo `MOCK_STORE_ID` — so the admin
 * keeps rendering with zero infrastructure, exactly like the data layer's
 * `isDbConfigured()` fallback. Set the env vars and real auth takes over with no
 * call-site changes.
 *
 * Route protection lives in the `(admin)` layout + page guards below (Node
 * runtime, so provisioning can touch Mongoose). Subdomain → store resolution for
 * the *storefront* is a separate concern owned by Stage 8's middleware.
 */

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;

/** Google OAuth is available when its client id + secret are set. */
const googleConfigured = Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
/** Email+password is available when a DB is configured to store/verify accounts. */
const credentialsConfigured = isDbConfigured();

/**
 * True when real auth is on: a session secret plus at least one usable sign-in
 * method (Google OAuth or email+password). Gates real-vs-stub everywhere — with
 * neither method configured the app stays in the Part A mock/stub fallback.
 */
export function isAuthConfigured(): boolean {
  return Boolean(NEXTAUTH_SECRET && (googleConfigured || credentialsConfigured));
}

const IS_PRODUCTION = process.env.NODE_ENV === "production";

/**
 * The Part A "mock/stub" fallback (open guards, demo `MOCK_STORE_ID`) is a DEV-ONLY
 * convenience. In production a missing auth configuration must FAIL CLOSED: every guard
 * then falls through to the real, session-checked path (which denies / redirects to
 * sign-in) instead of granting anonymous access to the admin + cross-tenant platform
 * portal. This is the single switch that decides "are we allowed to skip real auth".
 */
export function isStubMode(): boolean {
  return !isAuthConfigured() && !IS_PRODUCTION;
}

const providers = [
  ...(googleConfigured
    ? [Google({ clientId: GOOGLE_CLIENT_ID!, clientSecret: GOOGLE_CLIENT_SECRET! })]
    : []),
  ...(credentialsConfigured
    ? [
        Credentials({
          name: "Email and password",
          credentials: { email: {}, password: {} },
          /**
           * Verify email+password against the stored scrypt hash. Returning `null`
           * (unknown email, OAuth-only account, or wrong password) makes NextAuth
           * throw `CredentialsSignin`, which the sign-in action maps to a generic
           * "incorrect email or password" — no oracle on which check failed.
           */
          async authorize(creds) {
            const email = String(creds?.email ?? "").trim().toLowerCase();
            const password = String(creds?.password ?? "");
            if (!email || !password) return null;
            const identity = await authenticateCredentials(email, password);
            if (!identity) return null;
            // Audit the login (mirrors the OAuth path's auth.login event).
            await recordEvent({
              type: "auth.login",
              actorUserId: identity.userId,
              actorType: identity.role === "platform_admin" ? "platform_admin" : "merchant",
              target: { kind: "user", id: identity.userId },
            });
            return {
              id: identity.userId,
              email: identity.email,
              name: identity.name,
              role: identity.role,
              userId: identity.userId,
            };
          },
        }),
      ]
    : []),
];

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  secret: NEXTAUTH_SECRET,
  trustHost: true,
  // Shorten the stateless-JWT lifetime from NextAuth's 30-day default: a demoted/revoked
  // user (or a stolen token) should lose access in hours, not weeks. The platform-admin
  // guard additionally re-checks the DB per request (see requirePlatformAdmin).
  session: { strategy: "jwt", maxAge: 24 * 60 * 60, updateAge: 60 * 60 },
  pages: { signIn: "/sign-in" },
  callbacks: {
    /**
     * First sign-in → pin the merchant identity into the token. Two paths:
     *   • Google OAuth (`account.provider === "google"`, `profile` present) —
     *     provision-or-load the merchant and audit the login here.
     *   • Credentials — identity was already resolved (and audited) in `authorize`,
     *     so we just lift it off the returned `user` object.
     * Subsequent calls (no `account`) pass the token through unchanged.
     */
    async jwt({ token, account, profile, user }) {
      if (account?.provider === "google" && profile) {
        const identity = await provisionMerchant({
          googleId: String(profile.sub),
          email: String(profile.email),
          name: String(profile.name ?? profile.email),
        });
        token.userId = identity.userId;
        token.role = identity.role;
        // Audit the login (who's entering) — best-effort, never blocks sign-in.
        await recordEvent({
          type: "auth.login",
          actorUserId: identity.userId,
          actorType: identity.role === "platform_admin" ? "platform_admin" : "merchant",
          target: { kind: "user", id: identity.userId },
        });
      } else if (user?.userId) {
        token.userId = user.userId;
        token.role = user.role ?? "merchant";
      }
      return token;
    },
    /** Surface the provisioned identity on the session for server-side guards. */
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.userId ?? "");
        session.user.role = (token.role as "merchant" | "platform_admin") ?? "merchant";
      }
      return session;
    },
  },
});

/* ============================================================
   Server-side store resolution + route guards for the (admin) group.
   ============================================================ */

export interface MerchantContext {
  storeId: string;
  /** A claimed subdomain marks onboarding complete — the dashboard is reachable. */
  ready: boolean;
  /** True when a platform_admin is viewing this store via impersonation (read-only). */
  impersonating?: boolean;
  /** The operator's user id during impersonation (for the audit trail / banner). */
  operatorId?: string;
  /** The impersonated store's real owner (for the banner). */
  ownerId?: string;
}

/**
 * Resolve the signed-in merchant's store WITHOUT redirecting — for the layout,
 * which also hosts the anonymous auth screens and must not redirect-loop.
 * Returns `null` when there is no usable session (anonymous).
 */
export async function getMerchantContext(): Promise<MerchantContext | null> {
  if (isStubMode()) {
    return { storeId: MOCK_STORE_ID, ready: true }; // dev stub fallback (never in production)
  }
  let session: Session | null;
  try {
    session = await auth();
  } catch {
    // JWTSessionError / decryption failure — treat as unauthenticated (stale cookie)
    return null;
  }
  const userId = session?.user?.id;
  if (!userId) return null;

  // Impersonation branch — the ONLY path that returns a store the user doesn't own,
  // and reachable ONLY by a platform_admin holding a valid, operator-bound, unexpired
  // impersonation cookie (signature/expiry checked in `readImpersonation`). A merchant
  // with a forged/stolen cookie fails the role gate and falls through to the normal
  // ownership-checked path below, so the tenant invariant is never weakened for them.
  if (session?.user?.role === "platform_admin") {
    const imp = await readImpersonation();
    if (imp && imp.operatorId === userId) {
      const target = await getStore(imp.storeId);
      if (target) {
        return {
          storeId: target._id,
          ready: Boolean(target.subdomain),
          impersonating: true,
          operatorId: userId,
          ownerId: target.ownerId,
        };
      }
    }
  }

  // Normal path: resolve the active store from the DB, ownership-verified + self-healing.
  // This is the single chokepoint that authorizes every admin store access (PRD §9): a
  // user can only ever land on a store they own, no matter what active store is recorded.
  const store = await resolveActiveStore(userId);
  if (!store) return null;
  return { storeId: store._id, ready: Boolean(store.subdomain) };
}

/**
 * Block a mutating action while a platform_admin is impersonating (read-only v1).
 * Re-derives the impersonation state server-side from `getMerchantContext` — never a
 * client flag. Mutating actions call this right after `requireMerchantStoreId()`.
 */
export async function assertNotImpersonating(): Promise<void> {
  const ctx = await getMerchantContext();
  if (ctx?.impersonating) throw new ImpersonationReadOnlyError();
}

/**
 * The signed-in user's role on their ACTIVE store (Phase 6 RBAC). `owner` in stub mode
 * (single demo merchant) and while impersonating (operators get a full read-only view).
 * Null when there's no usable session.
 */
export async function getCurrentStoreRole(): Promise<StoreRole | null> {
  if (isStubMode()) return "owner";
  const ctx = await getMerchantContext();
  if (!ctx) return null;
  if (ctx.impersonating) return "owner";
  let session: Session | null;
  try {
    session = await auth();
  } catch {
    return null;
  }
  const userId = session?.user?.id;
  if (!userId) return null;
  return getStoreRole(ctx.storeId, userId, session?.user?.email ?? null);
}

/**
 * Permission guard for server actions (Phase 6 RBAC). Resolves the active store + the
 * user's role and throws `PermissionError` when the role doesn't grant `permission`.
 * Returns the `storeId` on success (so callers use it like `requireMerchantStoreId`).
 */
export async function requirePermission(permission: Permission): Promise<string> {
  const storeId = await requireMerchantStoreId();
  if (isStubMode()) return storeId; // dev stub only: full access
  const role = await getCurrentStoreRole();
  if (!roleHasPermission(role, permission)) throw new PermissionError(permission);
  return storeId;
}

/**
 * Hard guard for protected admin pages: returns the merchant's `storeId` or
 * redirects (`/sign-in` when anonymous, `/onboarding` when the subdomain is
 * unclaimed). Safe to call from any protected page — never from `/sign-in` or
 * `/onboarding` themselves, which would loop.
 */
export async function requireMerchantStoreId(): Promise<string> {
  if (isStubMode()) return MOCK_STORE_ID;

  // Pure operators (platform_admin) live in the separate /platform portal and have no
  // merchant store UI — EXCEPT while actively impersonating a store (read-only view).
  let session: Session | null = null;
  try {
    session = await auth();
  } catch {
    redirect("/sign-in");
  }
  if (!session?.user?.id) redirect("/sign-in");
  if (session.user.role === "platform_admin") {
    const imp = await readImpersonation();
    if (!imp || imp.operatorId !== session.user.id) redirect("/platform");
  }

  const ctx = await getMerchantContext();
  if (!ctx) redirect("/sign-in");
  if (!ctx.ready) redirect("/onboarding");
  return ctx.storeId;
}

/**
 * Minimal authentication guard for admin routes that aren't tied to a single
 * tenant's onboarding state. Ensures a signed-in session exists. Cross-tenant
 * operator views must additionally pass `requirePlatformAdmin` (below).
 */
/**
 * The signed-in user's id for activity logging (`recordEvent` actorUserId), or null
 * when anonymous / stub mode. Never throws — observability must not break callers.
 */
export async function getActorUserId(): Promise<string | null> {
  if (isStubMode()) return null;
  try {
    const session = await auth();
    return session?.user?.id ?? null;
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<void> {
  if (isStubMode()) return;
  let session: Session | null;
  try {
    session = await auth();
  } catch {
    redirect("/sign-in");
  }
  if (!session?.user?.id) redirect("/sign-in");
}

/**
 * Role guard for the platform-admin (internal, cross-tenant) surface — Stage 14
 * hardening of the deferred role check. The platform area reads and mutates data
 * across *every* tenant (suspend a store, set a plan), so it must never be reachable
 * by an ordinary merchant. Anonymous → `/sign-in`; a signed-in non-admin →
 * `notFound()` (a 404, so the route's existence isn't even disclosed). In stub mode
 * (no auth configured) it allows through so Part A demos keep working.
 */
export async function requirePlatformAdmin(): Promise<void> {
  if (isStubMode()) return;
  let session: Session | null;
  try {
    session = await auth();
  } catch {
    redirect("/sign-in");
  }
  if (!session?.user?.id) redirect("/sign-in");
  if (session.user.role !== "platform_admin") notFound();

  // The role is stamped into the JWT at sign-in and rides it for the token's lifetime.
  // For the cross-tenant platform portal that lag is unacceptable: a revoked/demoted
  // operator must lose access immediately, not whenever the token expires. Re-read the
  // authoritative role from the DB and deny if it no longer says platform_admin. (Only
  // the platform surface pays this per-request read; ordinary merchant traffic doesn't.)
  const { getUserById } = await import("@/lib/data/account");
  const fresh = await getUserById(session.user.id);
  if (!fresh || fresh.role !== "platform_admin") notFound();
}
