"use client";

import { useActionState, useId, useState } from "react";
import { Button, Icon, Input } from "@/components/ui";
import {
  signInCredentials,
  signUpCredentials,
  signInGoogle,
  type CredentialActionState,
} from "@/lib/auth/actions";
import { AuthFrame } from "./auth-frame";

/**
 * Sign in / Create account (DESIGN §4.2). One centered card with two equal sign-in
 * methods: **email + password** (the form below) and **Continue with Google**.
 *
 * A single `mode` toggle flips the same card between signing in and creating an
 * account (the "Get started" entry point deep-links here with `?mode=signup`). Each
 * mode has its own `useActionState` so a pending submit or error on one doesn't
 * bleed into the other. The actions work in both runtime modes: with auth
 * configured they drive NextAuth's Credentials provider; unconfigured (Part A) they
 * fall through to the onboarding demo flow, exactly like the Google button.
 */

const INITIAL: CredentialActionState = {};

export function SignIn({ initialMode = "signin" }: { initialMode?: "signin" | "signup" }) {
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [signInState, signInAction, signInPending] = useActionState(signInCredentials, INITIAL);
  const [signUpState, signUpAction, signUpPending] = useActionState(signUpCredentials, INITIAL);

  const isSignup = mode === "signup";
  const action = isSignup ? signUpAction : signInAction;
  const state = isSignup ? signUpState : signInState;
  const pending = isSignup ? signUpPending : signInPending;

  const nameId = useId();
  const emailId = useId();
  const passwordId = useId();

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
          {isSignup ? "Create your account" : "Sign in to Offshelf"}
        </h1>
        <p
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--text-muted)",
            marginBottom: "var(--space-6)",
          }}
        >
          {isSignup
            ? "Start selling in minutes. Your storefront, your rules."
            : "Your storefront, your rules. Sign in to manage your shop."}
        </p>

        {/* Email + password */}
        <form action={action} style={{ display: "grid", gap: "var(--space-4)" }}>
          {isSignup && (
            <Field id={nameId} label="Name">
              <Input
                id={nameId}
                name="name"
                large
                autoComplete="name"
                placeholder="Jordan Rivera"
              />
            </Field>
          )}
          <Field id={emailId} label="Email">
            <Input
              id={emailId}
              name="email"
              type="email"
              large
              required
              autoComplete="email"
              placeholder="you@store.com"
              error={Boolean(state.error)}
            />
          </Field>
          <Field id={passwordId} label="Password">
            <Input
              id={passwordId}
              name="password"
              type="password"
              large
              required
              minLength={isSignup ? 8 : undefined}
              autoComplete={isSignup ? "new-password" : "current-password"}
              placeholder={isSignup ? "At least 8 characters" : "Your password"}
              error={Boolean(state.error)}
            />
          </Field>

          {state.error && (
            <p
              role="alert"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: "var(--text-xs)",
                color: "var(--critical)",
                margin: 0,
              }}
            >
              <Icon name="alert" size={13} aria-hidden /> {state.error}
            </p>
          )}

          <Button
            variant="primary"
            size="lg"
            block
            type="submit"
            loading={pending}
            iconRight="arrowRight"
          >
            {isSignup ? "Create account" : "Sign in"}
          </Button>
        </form>

        {/* Divider */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            margin: "var(--space-5) 0",
            color: "var(--text-muted)",
            fontSize: "var(--text-2xs)",
          }}
        >
          <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
          or
          <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
        </div>

        {/* Google OAuth */}
        <form action={signInGoogle}>
          <button type="submit" className="btn btn-lg btn-default btn-block" style={{ gap: 10 }}>
            <Icon name="google" size={18} aria-hidden />
            Continue with Google
          </button>
        </form>

        {/* Mode toggle */}
        <p
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--text-muted)",
            textAlign: "center",
            marginTop: "var(--space-6)",
          }}
        >
          {isSignup ? "Already have an account? " : "New to Offshelf? "}
          <button
            type="button"
            onClick={() => setMode(isSignup ? "signin" : "signup")}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              font: "inherit",
              color: "var(--text-strong)",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {isSignup ? "Sign in" : "Create an account"}
          </button>
        </p>

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

/** Labelled field wrapper — small label above a full-width input. */
function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <label
        htmlFor={id}
        style={{
          fontSize: "var(--text-xs)",
          fontWeight: 500,
          color: "var(--text-strong)",
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}
