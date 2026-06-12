import { Icon, Pill, type IconName, type PillTone } from "@/components/ui";
import type { HealthCheckResult, HealthSeverity } from "@/types";

/**
 * Shared rendering helpers for the operator alignment / health engine. The store
 * detail screen and the cross-tenant Health screen both flag the same
 * `HealthCheckResult`s, so the severity → tone/label mapping and the single-row
 * renderer live here to stay consistent. Display-only; the rules run server-side.
 */

/** Map a health severity to an existing Pill tone (no bespoke colors — DESIGN §3.5). */
export const SEVERITY_TONE: Record<HealthSeverity, PillTone> = {
  high: "critical",
  medium: "warning",
  low: "info",
  info: "muted",
};

export const SEVERITY_LABEL: Record<HealthSeverity, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Info",
};

/** Worst (most severe) failing severity in a set — for sorting/grouping store rows. */
const SEVERITY_RANK: Record<HealthSeverity, number> = {
  high: 0,
  medium: 1,
  low: 2,
  info: 3,
};

export function worstSeverity(checks: HealthCheckResult[]): HealthSeverity {
  let worst: HealthSeverity = "info";
  for (const c of checks) {
    if (SEVERITY_RANK[c.severity] < SEVERITY_RANK[worst]) worst = c.severity;
  }
  return worst;
}

/** Sort failing-store groups by worst severity, then by failing count (desc). */
export function bySeverity<T extends { failing: HealthCheckResult[] }>(a: T, b: T): number {
  const ra = SEVERITY_RANK[worstSeverity(a.failing)];
  const rb = SEVERITY_RANK[worstSeverity(b.failing)];
  if (ra !== rb) return ra - rb;
  return b.failing.length - a.failing.length;
}

/**
 * One health-check row: ok/fail icon, severity pill, and message. Failing checks
 * are emphasized (stronger text + tinted background); passing checks are muted.
 */
export function HealthCheckRow({
  check,
  first,
}: {
  check: HealthCheckResult;
  first: boolean;
}) {
  const tone = SEVERITY_TONE[check.severity];
  const icon: IconName = check.ok ? "check" : "alertTri";
  const color = check.ok
    ? "var(--success)"
    : check.severity === "high"
      ? "var(--critical)"
      : "var(--warning)";

  return (
    <li
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "var(--space-3)",
        padding: "var(--space-3) var(--space-5)",
        borderTop: first ? "none" : "var(--border-w) solid var(--border)",
        background: check.ok ? undefined : "color-mix(in oklab, var(--critical) 4%, transparent)",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 22,
          height: 22,
          flexShrink: 0,
          color,
        }}
      >
        <Icon name={icon} size={16} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontSize: "var(--text-sm)",
              fontWeight: check.ok ? 400 : 500,
              color: check.ok ? "var(--text-muted)" : "var(--text-strong)",
            }}
          >
            {check.message}
          </span>
          <Pill tone={check.ok ? "muted" : tone} dot={false}>
            {SEVERITY_LABEL[check.severity]}
          </Pill>
        </div>
      </div>
      <span
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clip: "rect(0 0 0 0)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      >
        {check.ok ? "Passing" : "Failing"}
      </span>
    </li>
  );
}
