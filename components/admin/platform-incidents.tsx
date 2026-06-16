import type { ReactNode } from "react";
import Link from "next/link";
import type { ErrorSeverity, NeedsAttention, PlatformError } from "@/types";
import {
  cx,
  Card,
  Eyebrow,
  PageHeader,
  Pill,
  type PillTone,
} from "@/components/ui";
import { fmtDateTime } from "@/lib/format";
import { ResolveIncidentButton } from "./platform-incidents-resolve-button";

/**
 * Platform operator Incidents screen (Stage 14, DESIGN §4.12) — the cross-tenant
 * "what broke" triage view. A "needs attention" rollup leads (critical/open counts
 * go prominent when non-zero, otherwise a calm all-clear), followed by a server-nav
 * filter bar (open vs resolved · severity) and the error log. Filtering is entirely
 * URL-driven (`?status=` / `?severity=`) — no client state. The only interactive
 * client piece is the per-row resolve/reopen button.
 */

type Status = "open" | "resolved";

const SEVERITIES: readonly ErrorSeverity[] = ["info", "warning", "error", "critical"];

/** Severity → pill tone (no new tokens: error+critical both read as "critical"). */
const SEVERITY_TONE: Record<ErrorSeverity, PillTone> = {
  info: "muted",
  warning: "warning",
  error: "critical",
  critical: "critical",
};

const SEVERITY_LABEL: Record<ErrorSeverity, string> = {
  info: "Info",
  warning: "Warning",
  error: "Error",
  critical: "Critical",
};

/* ---- Needs-attention rollup ---- */

interface StatMeta {
  key: keyof NeedsAttention;
  label: string;
  hint?: string;
  /** When true and the value > 0, the card uses the critical tone. */
  critical?: boolean;
}

const STATS: StatMeta[] = [
  { key: "openErrors", label: "Open errors", critical: true },
  { key: "criticalErrors", label: "Critical errors", critical: true },
  { key: "misalignedStores", label: "Misaligned stores" },
  {
    key: "stuckOrders",
    label: "Stuck orders",
    hint: "Unpaid COD / in-store > 3 days",
  },
  { key: "suspendedStores", label: "Suspended stores" },
];

const GRID: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 160px), 1fr))",
  gap: "var(--space-4)",
  marginBottom: "var(--space-6)",
};

function StatCard({
  label,
  value,
  hint,
  alert,
}: {
  label: string;
  value: number;
  hint?: ReactNode;
  alert?: boolean;
}) {
  return (
    <Card
      style={
        alert
          ? {
              borderColor: "var(--critical)",
              background: "var(--critical-bg, var(--surface-sunken))",
            }
          : undefined
      }
    >
      <div className="stat-label">{label}</div>
      <div
        className="stat-value mono"
        style={alert ? { color: "var(--critical)" } : undefined}
      >
        {value}
      </div>
      {hint && (
        <div
          style={{
            marginTop: 4,
            fontSize: "var(--text-xs)",
            color: "var(--text-muted)",
          }}
        >
          {hint}
        </div>
      )}
    </Card>
  );
}

function hrefFor(status: Status, severity?: ErrorSeverity): string {
  const params = new URLSearchParams();
  if (status !== "open") params.set("status", status);
  if (severity) params.set("severity", severity);
  const qs = params.toString();
  return qs ? `/platform/incidents?${qs}` : "/platform/incidents";
}

export function PlatformIncidents({
  needs,
  errors,
  status,
  severity,
}: {
  needs: NeedsAttention;
  errors: PlatformError[];
  status: Status;
  severity?: ErrorSeverity;
}) {
  const total =
    needs.openErrors +
    needs.criticalErrors +
    needs.misalignedStores +
    needs.stuckOrders +
    needs.suspendedStores;
  const allClear = total === 0;

  return (
    <div>
      <PageHeader
        title="Incidents"
        meta="Cross-tenant operator triage — recorded failures and what needs a human."
      />

      <div style={{ marginBottom: "var(--space-3)" }}>
        <Eyebrow>Needs attention</Eyebrow>
      </div>

      {allClear ? (
        <Card
          style={{
            marginBottom: "var(--space-6)",
            textAlign: "center",
            color: "var(--text-muted)",
            fontSize: "var(--text-sm)",
          }}
        >
          All clear ✓
        </Card>
      ) : (
        <div style={GRID}>
          {STATS.map((s) => {
            const value = needs[s.key];
            return (
              <StatCard
                key={s.key}
                label={s.label}
                value={value}
                hint={s.hint}
                alert={Boolean(s.critical) && value > 0}
              />
            );
          })}
        </div>
      )}

      <div style={{ marginBottom: "var(--space-3)" }}>
        <Eyebrow>Incident log</Eyebrow>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--space-4)",
          marginBottom: "var(--space-4)",
        }}
      >
        <div role="group" aria-label="Filter by status" style={tabGroupStyle}>
          {(["open", "resolved"] as const).map((s) => (
            <Link
              key={s}
              href={hrefFor(s, severity)}
              className={cx("viewtab", status === s && "active")}
              aria-current={status === s ? "true" : undefined}
            >
              {s === "open" ? "Open" : "Resolved"}
            </Link>
          ))}
        </div>

        <div role="group" aria-label="Filter by severity" style={tabGroupStyle}>
          <Link
            href={hrefFor(status, undefined)}
            className={cx("viewtab", !severity && "active")}
            aria-current={!severity ? "true" : undefined}
          >
            All severities
          </Link>
          {SEVERITIES.map((sev) => (
            <Link
              key={sev}
              href={hrefFor(status, sev)}
              className={cx("viewtab", severity === sev && "active")}
              aria-current={severity === sev ? "true" : undefined}
            >
              {SEVERITY_LABEL[sev]}
            </Link>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: "var(--space-3)" }}>
        <Eyebrow>
          {errors.length} {errors.length === 1 ? "incident" : "incidents"}
          {severity ? ` · ${SEVERITY_LABEL[severity]}` : ""}
        </Eyebrow>
      </div>

      {errors.length === 0 ? (
        <Card
          style={{
            textAlign: "center",
            color: "var(--text-muted)",
            fontSize: "var(--text-sm)",
          }}
        >
          No incidents 🎉
        </Card>
      ) : (
        <ul className="card" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {errors.map((err, i) => (
            <IncidentRow key={err._id} error={err} resolved={status === "resolved"} first={i === 0} />
          ))}
        </ul>
      )}
    </div>
  );
}

const tabGroupStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 2,
};

function IncidentRow({
  error,
  resolved,
  first,
}: {
  error: PlatformError;
  resolved: boolean;
  first: boolean;
}) {
  const tone = SEVERITY_TONE[error.severity] ?? "muted";

  return (
    <li
      style={{
        display: "flex",
        gap: "var(--space-3)",
        padding: "var(--space-4) var(--space-5)",
        borderTop: first ? "none" : "var(--border-w) solid var(--border)",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            flexWrap: "wrap",
          }}
        >
          <Pill tone={tone}>{SEVERITY_LABEL[error.severity] ?? error.severity}</Pill>
          <span className="mono" style={{ fontSize: "var(--text-sm)", color: "var(--text-strong)" }}>
            {error.source}
          </span>
        </div>

        <div
          style={{
            marginTop: 4,
            fontSize: "var(--text-sm)",
            color: "var(--text)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={error.message}
        >
          {error.message}
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "var(--space-2)",
            marginTop: 4,
            fontSize: "var(--text-xs)",
            color: "var(--text-muted)",
          }}
        >
          <time dateTime={error.createdAt}>{fmtDateTime(error.createdAt)}</time>
          {error.storeId && (
            <>
              <span aria-hidden="true">·</span>
              <span className="mono">store {error.storeId.slice(-6)}</span>
            </>
          )}
        </div>

        {error.stack && (
          <details style={{ marginTop: "var(--space-2)" }}>
            <summary
              style={{
                cursor: "pointer",
                fontSize: "var(--text-xs)",
                color: "var(--text-muted)",
              }}
            >
              Stack trace
            </summary>
            <pre
              className="mono"
              style={{
                marginTop: "var(--space-2)",
                marginBottom: 0,
                maxHeight: 220,
                overflow: "auto",
                padding: "var(--space-3)",
                borderRadius: "var(--radius-md)",
                background: "var(--surface-sunken)",
                fontSize: "var(--text-2xs)",
                lineHeight: 1.5,
                whiteSpace: "pre",
              }}
            >
              {error.stack}
            </pre>
          </details>
        )}
      </div>

      <div style={{ flexShrink: 0, alignSelf: "flex-start" }}>
        <ResolveIncidentButton id={error._id} resolved={!resolved} />
      </div>
    </li>
  );
}
