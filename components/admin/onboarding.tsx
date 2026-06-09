"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Eyebrow, Icon } from "@/components/ui";
import type { SubdomainCheck } from "@/lib/data/subdomain";
import { checkSubdomainAvailability, claimSubdomain } from "@/lib/auth/actions";
import { APP_DOMAIN } from "@/lib/format";
import { AuthFrame } from "./auth-frame";

/**
 * Onboarding — claim subdomain (DESIGN §4.3, PRD §7.1). One focused decision: a
 * mono slug input with the trailing `.offshelf.app` baked in and a LIVE
 * availability check (DNS-safe format, reserved-word blocklist, uniqueness) run
 * server-side via `checkSubdomainAvailability`. "Claim & continue" persists the
 * subdomain to the signed-in merchant's store through `claimSubdomain`, then
 * lands on the dashboard. With auth unconfigured both actions fall back to the
 * Part A stub behaviour, so the demo flow is unchanged.
 */

type CheckState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "ok" }
  | { kind: "error"; reason: NonNullable<SubdomainCheck["reason"]> };

const REASON_COPY: Record<NonNullable<SubdomainCheck["reason"]>, string> = {
  taken: "That address is already taken",
  reserved: "That name is reserved",
  invalid: "Use lowercase letters, numbers, and hyphens (3–63 chars)",
};

export function Onboarding() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [state, setState] = useState<CheckState>({ kind: "idle" });
  const [claiming, setClaiming] = useState(false);
  const token = useRef(0);

  useEffect(() => {
    const v = value.trim();
    if (!v) {
      setState({ kind: "idle" });
      return;
    }
    setState({ kind: "checking" });
    const id = ++token.current;
    const t = setTimeout(async () => {
      const result = await checkSubdomainAvailability(v);
      if (id !== token.current) return; // a newer keystroke superseded this check
      setState(
        result.available
          ? { kind: "ok" }
          : { kind: "error", reason: result.reason ?? "invalid" },
      );
    }, 350);
    return () => clearTimeout(t);
  }, [value]);

  async function handleClaim() {
    setClaiming(true);
    const result = await claimSubdomain(value.trim());
    if (result.ok) {
      router.push("/dashboard");
      return; // keep the spinner up through navigation
    }
    setClaiming(false);
    setState({ kind: "error", reason: result.reason ?? "invalid" });
  }

  const isError = state.kind === "error";
  const preview = (value || "your-store") + "." + APP_DOMAIN;

  return (
    <AuthFrame>
      <div className="card" style={{ padding: "var(--space-8)" }}>
        <Eyebrow>Step 1 of 1</Eyebrow>
        <h1
          style={{
            fontSize: "var(--text-xl)",
            fontWeight: 600,
            color: "var(--text-strong)",
            letterSpacing: "-0.02em",
            margin: "8px 0 6px",
          }}
        >
          Claim your address
        </h1>
        <p
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--text-muted)",
            marginBottom: "var(--space-6)",
          }}
        >
          This is where your store lives. You can change it later in Settings.
        </p>

        <div
          style={{
            display: "flex",
            alignItems: "stretch",
            border: "1px solid " + (isError ? "var(--critical)" : "var(--border)"),
            borderRadius: "var(--radius-md)",
            overflow: "hidden",
            height: 48,
          }}
        >
          {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
          <input
            className="input mono"
            value={value}
            autoFocus
            aria-label="Subdomain"
            placeholder="your-store"
            onChange={(e) =>
              setValue(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
            }
            style={{ border: "none", borderRadius: 0, fontSize: "var(--text-md)", flex: 1 }}
          />
          <span
            style={{
              display: "flex",
              alignItems: "center",
              padding: "0 14px",
              background: "var(--surface-sunken)",
              color: "var(--text-muted)",
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-sm)",
              borderLeft: "1px solid var(--border)",
              whiteSpace: "nowrap",
            }}
          >
            .{APP_DOMAIN}
          </span>
        </div>

        <div
          style={{
            marginTop: 8,
            minHeight: 18,
            fontSize: "var(--text-xs)",
            display: "flex",
            alignItems: "center",
            gap: 6,
            color:
              state.kind === "ok"
                ? "var(--success)"
                : isError
                  ? "var(--critical)"
                  : "var(--text-muted)",
          }}
          role="status"
          aria-live="polite"
        >
          {state.kind === "checking" && "Checking availability…"}
          {state.kind === "ok" && (
            <>
              <Icon name="check" size={13} aria-hidden /> Available
            </>
          )}
          {isError && (
            <>
              <Icon name="alert" size={13} aria-hidden /> {REASON_COPY[state.reason]}
            </>
          )}
          {state.kind === "idle" && "Lowercase letters, numbers, and hyphens"}
        </div>

        <div
          style={{
            marginTop: "var(--space-5)",
            padding: "var(--space-3) var(--space-4)",
            background: "var(--surface-subtle)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Icon
            name="external"
            size={15}
            style={{ color: "var(--text-muted)" }}
            aria-hidden
          />
          <span
            className="mono"
            style={{ fontSize: "var(--text-sm)", color: "var(--text-strong)" }}
          >
            {preview}
          </span>
        </div>

        <Button
          variant="primary"
          size="lg"
          block
          iconRight="arrowRight"
          disabled={state.kind !== "ok" || claiming}
          loading={state.kind === "checking" || claiming}
          onClick={handleClaim}
          style={{ marginTop: "var(--space-6)" }}
        >
          Claim &amp; continue
        </Button>
      </div>
    </AuthFrame>
  );
}
