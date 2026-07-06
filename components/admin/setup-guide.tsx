"use client";

import { useState } from "react";
import Link from "next/link";
import type { Store } from "@/types";
import { Card, Icon } from "@/components/ui";

/**
 * Setup guide (Shopify's signature onboarding checklist). A brand-new store lands on an
 * empty dashboard with no sense of "what next"; this gives a guided, progress-tracked
 * list of the steps to a real, live store — with a progress ring that fills as each is
 * done. Completion is derived from the store's actual data (no separate tracking), so
 * a step ticks itself the moment it's satisfied. Hidden once every step is complete.
 */
interface Step {
  key: string;
  label: string;
  hint: string;
  href: string;
  cta: string;
  done: boolean;
}

export function SetupGuide({ store, activeProductCount }: { store: Store; activeProductCount: number }) {
  const steps: Step[] = [
    {
      key: "product",
      label: "Add your first product",
      hint: "Your store needs something to sell.",
      href: "/products/new",
      cta: "Add product",
      done: activeProductCount > 0,
    },
    {
      key: "branding",
      label: "Add your logo & branding",
      hint: "Make the storefront feel like yours.",
      href: "/settings",
      cta: "Add logo",
      done: Boolean(store.settings.logoUrl),
    },
    {
      key: "shipping",
      label: "Set up shipping",
      hint: "Tell customers how orders arrive.",
      href: "/settings",
      cta: "Set shipping",
      done: Boolean(store.settings.shipping?.enabled),
    },
    {
      key: "payments",
      label: "Choose payment methods",
      hint: "Decide how you'll get paid.",
      href: "/settings",
      cta: "Set payments",
      done: Boolean(store.settings.settlement),
    },
    {
      key: "publish",
      label: "Publish your store",
      hint: "Go live and start selling.",
      href: "/publish",
      cta: "Publish",
      done: store.status === "live",
    },
  ];

  const completed = steps.filter((s) => s.done).length;
  const total = steps.length;
  const [open, setOpen] = useState(true);

  // Nothing left to guide — let the normal dashboard shine.
  if (completed === total) return null;

  // Surface the first not-yet-done step as the highlighted next action.
  const nextStep = steps.find((s) => !s.done) ?? null;
  const pct = Math.round((completed / total) * 100);
  const ring = 2 * Math.PI * 15; // r=15

  return (
    <Card style={{ marginBottom: "var(--space-6)", padding: 0, overflow: "hidden" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "var(--space-4)",
          padding: "var(--space-4) var(--space-5)",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        {/* Progress ring */}
        <span style={{ position: "relative", width: 38, height: 38, flexShrink: 0 }}>
          <svg width="38" height="38" viewBox="0 0 38 38" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="19" cy="19" r="15" fill="none" stroke="var(--surface-sunken)" strokeWidth="4" />
            <circle
              cx="19"
              cy="19"
              r="15"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={ring}
              strokeDashoffset={ring * (1 - completed / total)}
              style={{ transition: "stroke-dashoffset 500ms var(--ease-emphasized, ease)" }}
            />
          </svg>
          <span
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              fontSize: "var(--text-2xs)",
              fontWeight: 700,
              color: "var(--text-strong)",
            }}
          >
            {completed}/{total}
          </span>
        </span>

        <span style={{ flex: 1 }}>
          <span style={{ display: "block", fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--text-strong)" }}>
            Set up your store
          </span>
          <span style={{ display: "block", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
            {pct}% complete{nextStep ? ` · Next: ${nextStep.label}` : ""}
          </span>
        </span>
        <Icon name={open ? "chevronUp" : "chevronDown"} size={18} aria-hidden />
      </button>

      {open && (
        <ul style={{ listStyle: "none", margin: 0, padding: "0 var(--space-3) var(--space-3)", display: "grid", gap: 2 }}>
          {steps.map((step) => (
            <li key={step.key}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-3)",
                  padding: "var(--space-3) var(--space-3)",
                  borderRadius: "var(--radius-md)",
                  background: step.done ? "transparent" : "var(--surface-subtle)",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                    background: step.done ? "var(--success)" : "var(--surface)",
                    border: step.done ? "none" : "1.5px solid var(--border-strong)",
                    color: "var(--warm-0)",
                  }}
                >
                  {step.done && <Icon name="check" size={12} aria-hidden />}
                </span>
                <span style={{ flex: 1 }}>
                  <span
                    style={{
                      display: "block",
                      fontSize: "var(--text-sm)",
                      fontWeight: 500,
                      color: "var(--text-strong)",
                      textDecoration: step.done ? "line-through" : "none",
                      opacity: step.done ? 0.6 : 1,
                    }}
                  >
                    {step.label}
                  </span>
                  {!step.done && (
                    <span style={{ display: "block", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                      {step.hint}
                    </span>
                  )}
                </span>
                {!step.done && (
                  <Link href={step.href} className="btn btn-sm btn-default">
                    {step.cta}
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
