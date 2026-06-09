"use client";

import { useEffect, useRef } from "react";
import { Icon } from "@/components/ui/icon";
import { StoreLogo } from "./store-logo";
import { useStorefront } from "./storefront-context";

/**
 * Age gate (DESIGN §5.1 / PRD §6.6) — the full-screen 21+ interstitial shown
 * before any storefront content. Dark `--warm-900` backdrop, centered card with the
 * store's configurable message, a primary "Enter" and a secondary "Leave" that
 * navigates away. On enter, `verifyAge()` stamps the session cookie + `ageVerifiedAt`
 * (later attached to orders). Calm and legal-feeling — not a marketing gate.
 *
 * The gate renders whenever the visitor is unverified — including the server render
 * and the first client paint — so storefront content is never shown before the gate.
 * A returning, already-verified visitor sees it dismiss the moment the cookie is read
 * on mount (no content leaks the other way, which is what matters for compliance).
 */
export function AgeGate({ message, minAge = 21 }: { message: string; minAge?: number }) {
  const sf = useStorefront();
  const enterRef = useRef<HTMLButtonElement>(null);

  const blocking = sf != null && !sf.verified;

  // Lock background scroll + focus the primary action while the gate blocks content.
  useEffect(() => {
    if (!blocking) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    enterRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, [blocking]);

  if (!blocking) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-gate-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        background: "var(--warm-900)",
        display: "grid",
        placeItems: "center",
        padding: "var(--space-6)",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(120% 90% at 50% 0%, #23201a 0%, #16140E 70%)",
        }}
      />
      <div style={{ position: "relative", maxWidth: 440, width: "100%", textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "var(--space-8)" }}>
          <StoreLogo dark />
        </div>
        <div
          style={{
            background: "rgba(250,249,245,0.04)",
            border: "1px solid rgba(250,249,245,0.12)",
            borderRadius: "var(--radius-xl)",
            padding: "var(--space-10) var(--space-8)",
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "rgba(198,242,78,0.14)",
              display: "grid",
              placeItems: "center",
              margin: "0 auto var(--space-5)",
              color: "var(--lime-400)",
            }}
          >
            <Icon name="lock" size={20} aria-hidden />
          </div>
          <h1
            id="age-gate-title"
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              fontSize: "var(--text-xl)",
              color: "var(--warm-50)",
              letterSpacing: "-0.01em",
              margin: 0,
            }}
          >
            Verify your age
          </h1>
          <p
            style={{
              marginTop: "var(--space-3)",
              fontSize: "var(--text-base)",
              lineHeight: 1.55,
              color: "rgba(250,249,245,0.62)",
            }}
          >
            {message}
          </p>
          <button
            ref={enterRef}
            type="button"
            onClick={() => sf!.verifyAge()}
            className="btn btn-lg btn-pill btn-block"
            style={{
              marginTop: "var(--space-6)",
              background: "var(--lime-400)",
              color: "var(--warm-900)",
              fontWeight: 600,
            }}
          >
            I am {minAge} or older — Enter
          </button>
          <a
            href="https://www.google.com"
            style={{
              display: "block",
              marginTop: "var(--space-3)",
              fontSize: "var(--text-sm)",
              color: "rgba(250,249,245,0.5)",
            }}
          >
            I am under {minAge} — Leave
          </a>
        </div>
        <p
          style={{
            marginTop: "var(--space-4)",
            fontSize: "var(--text-xs)",
            color: "rgba(250,249,245,0.36)",
            lineHeight: 1.5,
          }}
        >
          This is a compliance requirement, not a marketing gate. Your confirmation is recorded
          with each order.
        </p>
      </div>
    </div>
  );
}
