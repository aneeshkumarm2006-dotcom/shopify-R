import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { redirect, notFound } from "next/navigation";
import { getStore } from "@/lib/data/store";
import { MOCK_STORE_ID } from "@/lib/data/mocks";
import { provisionMerchant } from "./provision";

/**
 * Real auth (TODO Stage 7, PRD §6.1 / §7.1) — NextAuth (Auth.js v5) with a single
 * Google OAuth provider and a stateless **JWT** session (no DB session table; the
 * merchant's identity lives in the signed token). On the *first* sign-in the `jwt`
 * callback provisions the user + draft store + subscription (see `./provision`)
 * and stamps the resulting `storeId` into the token, so every later request knows
 * which tenant the session owns without another lookup.
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

/** True when Google OAuth + a session secret are configured; gates real-vs-stub. */
export function isAuthConfigured(): boolean {
  return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && NEXTAUTH_SECRET);
}

const providers = isAuthConfigured()
  ? [Google({ clientId: GOOGLE_CLIENT_ID!, clientSecret: GOOGLE_CLIENT_SECRET! })]
  : [];

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  secret: NEXTAUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/sign-in" },
  callbacks: {
    /**
     * First sign-in (`account` present) → provision/load the merchant and pin
     * their identity into the token. Subsequent calls just pass the token through.
     */
    async jwt({ token, account, profile }) {
      if (account && profile) {
        const identity = await provisionMerchant({
          googleId: String(profile.sub),
          email: String(profile.email),
          name: String(profile.name ?? profile.email),
        });
        token.userId = identity.userId;
        token.storeId = identity.storeId;
        token.role = identity.role;
      }
      return token;
    },
    /** Surface the provisioned identity on the session for server-side guards. */
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.userId ?? "");
        session.user.storeId = String(token.storeId ?? "");
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
}

/**
 * Resolve the signed-in merchant's store WITHOUT redirecting — for the layout,
 * which also hosts the anonymous auth screens and must not redirect-loop.
 * Returns `null` when there is no usable session (anonymous).
 */
export async function getMerchantContext(): Promise<MerchantContext | null> {
  if (!isAuthConfigured()) {
    return { storeId: MOCK_STORE_ID, ready: true }; // Part A / mock fallback
  }
  const session = await auth();
  const storeId = session?.user?.storeId;
  if (!storeId) return null;
  const store = await getStore(storeId);
  if (!store) return null;
  return { storeId, ready: Boolean(store.subdomain) };
}

/**
 * Hard guard for protected admin pages: returns the merchant's `storeId` or
 * redirects (`/sign-in` when anonymous, `/onboarding` when the subdomain is
 * unclaimed). Safe to call from any protected page — never from `/sign-in` or
 * `/onboarding` themselves, which would loop.
 */
export async function requireMerchantStoreId(): Promise<string> {
  if (!isAuthConfigured()) return MOCK_STORE_ID;
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
export async function requireSession(): Promise<void> {
  if (!isAuthConfigured()) return;
  const session = await auth();
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
  if (!isAuthConfigured()) return;
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  if (session.user.role !== "platform_admin") notFound();
}
