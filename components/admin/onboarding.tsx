"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Eyebrow, Icon } from "@/components/ui";
import type { SubdomainCheck } from "@/lib/data/subdomain";
import { checkSubdomainAvailability, claimSubdomain } from "@/lib/auth/actions";
import { STORE_TEMPLATES, type StoreTemplateId } from "@/lib/data/store-templates";
import { APP_DOMAIN } from "@/lib/format";
import { AuthFrame } from "./auth-frame";

/**
 * Onboarding — claim subdomain, then pick a starting point (DESIGN §4.3, PRD §7.1).
 *
 * Step 1 (address): a mono slug input with the trailing `.offshelf.app` baked in
 * and a LIVE availability check (DNS-safe format, reserved-word blocklist,
 * uniqueness) run server-side via `checkSubdomainAvailability`. "Continue" only
 * advances the UI — nothing is persisted yet.
 *
 * Step 2 (template): three vertical-specific starter storefronts (Smoke & Vape,
 * CBD & Wellness, Dispensary) plus a low-emphasis "start from scratch" option.
 * "Create my store" submits BOTH choices through `claimSubdomain(value, template)`
 * in one shot — abandoning mid-flow persists nothing, and a subdomain race lost
 * between the live check and the final claim bounces back to step 1 with the
 * error. With auth unconfigured the action falls back to the Part A stub
 * behaviour, so the demo flow is unchanged.
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

export function Onboarding({ suggested = "" }: { suggested?: string }) {
  const router = useRouter();
  const [step, setStep] = useState<"address" | "template" | "done">("address");
  const [value, setValue] = useState(suggested);
  // The server pre-validated `suggested` as available, so start "ok" (Continue is
  // clickable immediately) rather than forcing a check-and-wait on a prefilled value.
  const [state, setState] = useState<CheckState>(suggested ? { kind: "ok" } : { kind: "idle" });
  const [template, setTemplate] = useState<StoreTemplateId | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimedSub, setClaimedSub] = useState("");
  const token = useRef(0);
  // Skip the first debounced re-check when the field still holds the server suggestion.
  const skipFirstCheck = useRef(Boolean(suggested));

  // After the celebratory success step, glide the merchant into their dashboard.
  useEffect(() => {
    if (step !== "done") return;
    const t = setTimeout(() => router.push("/dashboard"), 2600);
    return () => clearTimeout(t);
  }, [step, router]);

  useEffect(() => {
    const v = value.trim();
    if (!v) {
      setState({ kind: "idle" });
      return;
    }
    // The prefilled suggestion was already validated server-side — don't flash a
    // "checking" spinner on mount. Any subsequent edit runs the real check.
    if (skipFirstCheck.current) {
      skipFirstCheck.current = false;
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

  async function handleCreate() {
    if (!template) return;
    setClaiming(true);
    const result = await claimSubdomain(value.trim(), template);
    if (result.ok) {
      // Mark the emotional peak of the funnel with a real success beat before the
      // dashboard, instead of a silent hard navigation.
      setClaimedSub(value.trim());
      setStep("done");
      return;
    }
    // Almost always a subdomain race lost since the live check — surface it
    // back on the address step where the error copy makes sense.
    setClaiming(false);
    setStep("address");
    setState({ kind: "error", reason: result.reason ?? "invalid" });
  }

  const isError = state.kind === "error";
  const preview = (value || "your-store") + "." + APP_DOMAIN;

  /* --------------------------------------------------------- success · done */
  if (step === "done") {
    return (
      <AuthFrame>
        <div
          className="card"
          style={{ padding: "var(--space-8)", textAlign: "center" }}
          role="status"
          aria-live="polite"
        >
          <div className="onboarding-celebrate" style={{ margin: "0 auto var(--space-5)" }}>
            <Icon name="check" size={34} aria-hidden />
          </div>
          <h1
            style={{
              fontSize: "var(--text-2xl)",
              fontWeight: 700,
              color: "var(--text-strong)",
              letterSpacing: "-0.02em",
              margin: "0 0 8px",
            }}
          >
            Your store is ready 🎉
          </h1>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", margin: "0 0 4px" }}>
            You claimed
          </p>
          <p
            className="mono"
            style={{
              fontSize: "var(--text-base)",
              fontWeight: 600,
              color: "var(--text-strong)",
              margin: "0 0 var(--space-6)",
            }}
          >
            {claimedSub}.{APP_DOMAIN}
          </p>
          <Button
            variant="primary"
            size="lg"
            block
            iconRight="arrowRight"
            onClick={() => router.push("/dashboard")}
          >
            Go to your dashboard
          </Button>
          <p style={{ fontSize: "var(--text-2xs)", color: "var(--text-muted)", marginTop: "var(--space-4)" }}>
            Taking you there…
          </p>
        </div>
      </AuthFrame>
    );
  }

  /* ------------------------------------------------------ step 2 · template */
  if (step === "template") {
    return (
      <AuthFrame width={780}>
        <div className="card" style={{ padding: "var(--space-8)" }}>
          <Eyebrow>Step 2 of 2</Eyebrow>
          <h1
            style={{
              fontSize: "var(--text-xl)",
              fontWeight: 600,
              color: "var(--text-strong)",
              letterSpacing: "-0.02em",
              margin: "8px 0 6px",
            }}
          >
            Pick a starting point
          </h1>
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--text-muted)",
              marginBottom: "var(--space-2)",
            }}
          >
            Each template is a complete storefront for your vertical — sections, copy, and
            categories you can edit, reorder, or replace in the builder.
          </p>
          <p
            className="mono"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: "var(--text-xs)",
              color: "var(--text-muted)",
              marginBottom: "var(--space-6)",
            }}
          >
            <Icon name="external" size={13} aria-hidden /> {preview}
          </p>

          <div
            role="group"
            aria-label="Store template"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
              gap: "var(--space-4)",
            }}
          >
            {STORE_TEMPLATES.map((t) => (
              <TemplateCard
                key={t.id}
                id={t.id}
                name={t.name}
                badge={t.badge}
                description={t.description}
                selected={template === t.id}
                onSelect={() => setTemplate(t.id)}
              />
            ))}
          </div>

          <ScratchOption selected={template === "blank"} onSelect={() => setTemplate("blank")} />

          <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-6)" }}>
            <Button
              variant="ghost"
              size="lg"
              icon="chevronLeft"
              disabled={claiming}
              onClick={() => setStep("address")}
            >
              Back
            </Button>
            <Button
              variant="primary"
              size="lg"
              iconRight="arrowRight"
              disabled={!template || claiming}
              loading={claiming}
              onClick={handleCreate}
              style={{ flex: 1 }}
            >
              Create my store
            </Button>
          </div>
        </div>
      </AuthFrame>
    );
  }

  /* ------------------------------------------------------- step 1 · address */
  return (
    <AuthFrame>
      <div className="card" style={{ padding: "var(--space-8)" }}>
        <Eyebrow>Step 1 of 2</Eyebrow>
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
          {suggested
            ? "We picked one for you — keep it or make it your own. You can change it later in Settings."
            : "This is where your store lives. You can change it later in Settings."}
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
          disabled={state.kind !== "ok"}
          loading={state.kind === "checking"}
          onClick={() => setStep("template")}
          style={{ marginTop: "var(--space-6)" }}
        >
          Continue
        </Button>
      </div>
    </AuthFrame>
  );
}

/* ================================================================ template UI */

function TemplateCard({
  id,
  name,
  badge,
  description,
  selected,
  onSelect,
}: {
  id: StoreTemplateId;
  name: string;
  badge: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      style={{
        textAlign: "left",
        padding: 0,
        background: selected ? "var(--accent-tint)" : "var(--surface)",
        border: "var(--border-w) solid " + (selected ? "var(--accent-pressed)" : "var(--border)"),
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        cursor: "pointer",
        transition:
          "border-color var(--dur-fast) var(--ease-standard), background-color var(--dur-fast) var(--ease-standard)",
      }}
    >
      <div style={{ position: "relative" }}>
        <TemplateThumb id={id} />
        <span
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            padding: "2px 8px",
            borderRadius: "var(--radius-pill)",
            background: "var(--surface)",
            border: "var(--border-w) solid var(--border)",
            fontSize: "var(--text-2xs)",
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
          }}
        >
          {badge}
        </span>
        {selected && (
          <span
            aria-hidden
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: "var(--accent)",
              color: "var(--text-on-accent)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <Icon name="check" size={12} />
          </span>
        )}
      </div>
      <div style={{ padding: "12px 14px 14px", borderTop: "var(--border-w) solid var(--border)" }}>
        <span
          style={{
            display: "block",
            fontSize: "var(--text-sm)",
            fontWeight: 600,
            color: "var(--text-strong)",
            marginBottom: 4,
          }}
        >
          {name}
        </span>
        <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", lineHeight: 1.45 }}>
          {description}
        </p>
      </div>
    </button>
  );
}

function ScratchOption({ selected, onSelect }: { selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      style={{
        width: "100%",
        marginTop: "var(--space-4)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "var(--space-3) var(--space-4)",
        background: selected ? "var(--accent-tint)" : "transparent",
        border:
          "var(--border-w) " +
          (selected ? "solid var(--accent-pressed)" : "dashed var(--border)"),
        borderRadius: "var(--radius-md)",
        cursor: "pointer",
        textAlign: "left",
        transition:
          "border-color var(--dur-fast) var(--ease-standard), background-color var(--dur-fast) var(--ease-standard)",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 30,
          height: 30,
          borderRadius: "var(--radius-sm)",
          background: selected ? "var(--accent)" : "var(--surface-sunken)",
          color: selected ? "var(--text-on-accent)" : "var(--text-muted)",
          display: "grid",
          placeItems: "center",
          flex: "none",
        }}
      >
        <Icon name={selected ? "check" : "plus"} size={15} />
      </span>
      <span style={{ flex: 1 }}>
        <span
          style={{
            display: "block",
            fontSize: "var(--text-sm)",
            fontWeight: 600,
            color: "var(--text-strong)",
          }}
        >
          Start from scratch
        </span>
        <span style={{ display: "block", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
          An empty store — add every section yourself in the builder.
        </span>
      </span>
    </button>
  );
}

/* ------------------------------------------------------------- mini previews */

/** Skeleton bar — the thumbnails sketch each template's layout, not its copy. */
function Bar({
  w,
  h = 5,
  color,
  pill,
  center,
}: {
  w: number | string;
  h?: number;
  color: string;
  pill?: boolean;
  center?: boolean;
}) {
  return (
    <span
      style={{
        display: "block",
        width: w,
        height: h,
        background: color,
        borderRadius: pill ? 999 : 2,
        marginInline: center ? "auto" : undefined,
      }}
    />
  );
}

/** A row of n identical tiles (product cards, category tiles, gallery cells). */
function Tiles({ n, h, color, radius = 3 }: { n: number; h: number; color: string; radius?: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${n}, 1fr)`, gap: 4 }}>
      {Array.from({ length: n }, (_, i) => (
        <span key={i} style={{ display: "block", height: h, background: color, borderRadius: radius }} />
      ))}
    </div>
  );
}

/**
 * Hand-drawn skeleton of each template's home page — same blocks, same order,
 * same light/dark rhythm as the real sections, so the card honestly previews
 * the layout the merchant will land in.
 */
function TemplateThumb({ id }: { id: StoreTemplateId }) {
  const ink = "rgba(250,249,245,0.92)"; // heading bars on dark heroes
  const dark = "var(--warm-900)";
  const lime = "var(--lime-400)";
  const soft = "var(--lime-100)";
  const tile = "var(--surface-sunken)";
  const text = "var(--border)"; // muted body-copy bars on light ground

  const frame: React.CSSProperties = {
    aspectRatio: "16 / 10",
    background: "var(--warm-0)",
    padding: 10,
    display: "flex",
    flexDirection: "column",
    gap: 6,
    overflow: "hidden",
  };

  if (id === "smoke-vape") {
    return (
      <div style={frame} aria-hidden>
        {/* tall dark hero, left-aligned, lime CTA */}
        <div
          style={{
            background: dark,
            borderRadius: 4,
            padding: 9,
            display: "flex",
            flexDirection: "column",
            gap: 5,
            flex: 1,
            justifyContent: "center",
          }}
        >
          <Bar w={28} h={5} color="rgba(198,242,78,0.55)" pill />
          <Bar w="68%" h={7} color={ink} />
          <Bar w="44%" h={7} color={ink} />
          <span style={{ height: 1 }} />
          <Bar w={34} h={9} color={lime} pill />
        </div>
        {/* fresh drops product row */}
        <Tiles n={4} h={20} color={tile} />
        {/* dark category tiles */}
        <Tiles n={4} h={14} color={dark} />
      </div>
    );
  }

  if (id === "cbd-wellness") {
    return (
      <div style={frame} aria-hidden>
        {/* calm centered hero on soft ground */}
        <div
          style={{
            background: soft,
            borderRadius: 4,
            padding: 9,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 5,
            flex: 1,
          }}
        >
          <Bar w={28} h={5} color="rgba(198,242,78,0.9)" pill />
          <Bar w="52%" h={7} color={dark} />
          <Bar w={30} h={9} color={dark} pill />
        </div>
        {/* centered trust copy */}
        <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "center" }}>
          <Bar w="64%" h={3} color={text} center />
          <Bar w="46%" h={3} color={text} center />
        </div>
        {/* format tiles */}
        <Tiles n={4} h={18} color={tile} />
      </div>
    );
  }

  if (id === "dispensary") {
    return (
      <div style={frame} aria-hidden>
        {/* compact menu hero */}
        <div
          style={{
            background: dark,
            borderRadius: 4,
            padding: 8,
            display: "flex",
            flexDirection: "column",
            gap: 4,
            justifyContent: "center",
            minHeight: 34,
          }}
        >
          <Bar w="56%" h={6} color={ink} />
          <Bar w={26} h={7} color={lime} pill />
        </div>
        {/* dense menu: categories, staff picks, gallery */}
        <Tiles n={4} h={17} color={dark} />
        <Tiles n={4} h={14} color={tile} />
        <Tiles n={3} h={11} color={soft} />
      </div>
    );
  }

  return <div style={frame} aria-hidden />;
}
