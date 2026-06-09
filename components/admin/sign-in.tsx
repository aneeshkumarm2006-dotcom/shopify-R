"use client";

import { Icon } from "@/components/ui";
import { signInGoogle } from "@/lib/auth/actions";
import { AuthFrame } from "./auth-frame";

/**
 * Sign in (DESIGN §4.2) — single centered card, one-line value prop, a single
 * **Continue with Google** action (OAuth only per PRD — no email/password).
 *
 * The button submits to the `signInGoogle` server action: with NextAuth
 * configured it starts the Google OAuth flow and lands on the dashboard (the
 * `(admin)` guard forwards brand-new merchants to onboarding); unconfigured, the
 * action falls back to the Part A stub and routes straight to onboarding.
 */
export function SignIn() {
  return (
    <AuthFrame>
      <div
        className="card"
        style={{ padding: "var(--space-8)", position: "relative", overflow: "hidden" }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: "var(--accent)",
          }}
        />
        <h1
          style={{
            fontSize: "var(--text-xl)",
            fontWeight: 600,
            color: "var(--text-strong)",
            letterSpacing: "-0.02em",
            marginBottom: 6,
          }}
        >
          Sign in to Offshelf
        </h1>
        <p
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--text-muted)",
            marginBottom: "var(--space-6)",
          }}
        >
          Your storefront, your rules. Sign in to manage your shop.
        </p>
        <form action={signInGoogle}>
          <button
            type="submit"
            className="btn btn-lg btn-default btn-block"
            style={{ gap: 10 }}
          >
            <Icon name="google" size={18} aria-hidden />
            Continue with Google
          </button>
        </form>
        <p
          style={{
            fontSize: "var(--text-2xs)",
            color: "var(--text-muted)",
            textAlign: "center",
            marginTop: "var(--space-5)",
            lineHeight: 1.5,
          }}
        >
          By continuing you agree to the Terms of Service and acknowledge the Privacy
          Policy. Age- and compliance-gated verticals only.
        </p>
      </div>
    </AuthFrame>
  );
}
