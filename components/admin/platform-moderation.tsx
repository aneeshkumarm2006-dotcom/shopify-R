import Link from "next/link";
import type { MisalignedStore } from "@/lib/data";
import { Eyebrow, Icon, PageHeader, Pill } from "@/components/ui";
import { storeStatusPill } from "@/components/admin/shared";
import {
  bySeverity,
  HealthCheckRow,
  SEVERITY_LABEL,
  SEVERITY_TONE,
  worstSeverity,
} from "@/components/admin/platform-health-shared";
import { storeDomain } from "@/lib/format";

/**
 * Platform operator Moderation queue (operator P3) — the compliance subset of the
 * store health engine: stores failing a policy/legal rule (age gate off on a
 * restricted vertical, injected `<script>`). Each row links to the operator store
 * detail and lists its failing compliance checks via the shared `HealthCheckRow`.
 * Read-only; the rules run server-side. Empty means every store is policy-compliant.
 */
export function PlatformModeration({ stores }: { stores: MisalignedStore[] }) {
  const sorted = [...stores].sort(bySeverity);

  return (
    <div>
      <PageHeader
        title="Moderation"
        meta="Stores flagged for policy/legal compliance — age gate off on restricted verticals, injected scripts."
      />

      <div style={{ marginBottom: "var(--space-3)" }}>
        <Eyebrow>
          {sorted.length} {sorted.length === 1 ? "store" : "stores"} flagged
        </Eyebrow>
      </div>

      {sorted.length === 0 ? (
        <div
          className="card"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "var(--space-2)",
            padding: "var(--space-6) var(--space-5)",
            textAlign: "center",
            color: "var(--text-muted)",
            fontSize: "var(--text-sm)",
          }}
        >
          <Icon name="check" size={22} aria-hidden style={{ color: "var(--success)" }} />
          No compliance flags — all stores look policy-compliant ✓
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          {sorted.map((s) => {
            const pill = storeStatusPill(s.status);
            const worst = worstSeverity(s.failing);
            return (
              <div key={s.id} className="card" style={{ overflow: "hidden" }}>
                <div
                  className="card-header"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-3)",
                    flexWrap: "wrap",
                  }}
                >
                  <Link
                    href={`/platform/stores/${s.id}`}
                    style={{
                      fontWeight: 600,
                      color: "var(--text-strong)",
                      textDecoration: "none",
                    }}
                  >
                    {s.name}
                  </Link>
                  <span
                    className="mono"
                    style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)" }}
                  >
                    {storeDomain(s.subdomain)}
                  </span>
                  <Pill tone={pill.tone}>{pill.label}</Pill>
                  <span
                    style={{
                      marginLeft: "auto",
                      display: "flex",
                      gap: "var(--space-2)",
                      alignItems: "center",
                    }}
                  >
                    <Pill tone={SEVERITY_TONE[worst]} dot={false}>
                      {SEVERITY_LABEL[worst]}
                    </Pill>
                    <Pill tone="muted" dot={false}>
                      {s.failing.length} flagged
                    </Pill>
                  </span>
                </div>
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {s.failing.map((c, i) => (
                    <HealthCheckRow key={c.id} check={c} first={i === 0} />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
