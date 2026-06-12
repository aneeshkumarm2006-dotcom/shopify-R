import type { ReactNode } from "react";
import type { PlatformKpis } from "@/types";
import { Card, Eyebrow, PageHeader } from "@/components/ui";
import { money } from "@/lib/format";

/**
 * Platform operator Overview (Stage 14, DESIGN §4.12) — a read-only KPI dashboard
 * rolled up cross-tenant from `getPlatformKpis()`. Reuses the merchant dashboard's
 * stat-card look (`.stat-label` / `.stat-value`) but without deltas — these are
 * point-in-time operator counts, not period analytics. GMV is a proxy (sum of paid
 * order totals); there's no real billing pipeline.
 */

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: ReactNode;
}) {
  return (
    <Card>
      <div className="stat-label">{label}</div>
      <div className="stat-value mono">{value}</div>
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

const GRID: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: "var(--space-4)",
  marginBottom: "var(--space-6)",
};

export function PlatformOverview({ kpis }: { kpis: PlatformKpis }) {
  const planTotal = kpis.freePlan + kpis.standardPlan;
  const standardPct =
    planTotal > 0 ? Math.round((kpis.standardPlan / planTotal) * 100) : 0;

  return (
    <div>
      <PageHeader
        title="Overview"
        meta="Cross-tenant operator KPIs — read-only, point-in-time."
      />

      <div style={{ marginBottom: "var(--space-3)" }}>
        <Eyebrow>Stores</Eyebrow>
      </div>
      <div style={GRID}>
        <StatCard label="Total stores" value={String(kpis.totalStores)} />
        <StatCard label="Live" value={String(kpis.liveStores)} />
        <StatCard label="Draft" value={String(kpis.draftStores)} />
        <StatCard label="Suspended" value={String(kpis.suspendedStores)} />
      </div>

      <div style={{ marginBottom: "var(--space-3)" }}>
        <Eyebrow>Plan mix</Eyebrow>
      </div>
      <div style={GRID}>
        <StatCard label="Free plan" value={String(kpis.freePlan)} />
        <StatCard
          label="Standard plan"
          value={String(kpis.standardPlan)}
          hint={`${standardPct}% of plans`}
        />
        <StatCard label="New stores · 7d" value={String(kpis.newStores7d)} />
        <StatCard label="New stores · 30d" value={String(kpis.newStores30d)} />
      </div>

      <div style={{ marginBottom: "var(--space-3)" }}>
        <Eyebrow>Network</Eyebrow>
      </div>
      <div style={{ ...GRID, gridTemplateColumns: "repeat(3, 1fr)", marginBottom: 0 }}>
        <StatCard label="Total merchants" value={String(kpis.totalMerchants)} />
        <StatCard label="Total orders" value={String(kpis.totalOrders)} />
        <StatCard
          label="GMV (paid orders) · proxy"
          value={money(kpis.gmvPaid)}
          hint="Sum of paid order totals — no real billing pipeline."
        />
      </div>
    </div>
  );
}
