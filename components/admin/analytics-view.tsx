import Link from "next/link";
import type { StoreAnalytics } from "@/lib/data";
import { Card, PageHeader, Pill } from "@/components/ui";
import { money } from "@/lib/format";

/**
 * Analytics dashboard (Phase 6) — presentational. The funnel, attribution, cohorts,
 * and top-products data are computed server-side; this lays them out. Period toggle is
 * plain links (?period=) so the server re-queries; no client state needed.
 */
export function AnalyticsView({
  analytics,
  currency,
}: {
  analytics: StoreAnalytics;
  currency: string;
}) {
  const { funnel, referrers, cohorts, topProducts, daily, revenue, period } = analytics;
  const maxDay = Math.max(1, ...daily.map((d) => d.sales));

  return (
    <div>
      <PageHeader
        title="Analytics"
        actions={
          <div style={{ display: "flex", gap: 4 }}>
            {(["7d", "30d"] as const).map((p) => (
              <Link
                key={p}
                href={`/analytics?period=${p}`}
                className="btn btn-sm"
                style={{
                  border: `1px solid ${period === p ? "var(--accent)" : "var(--border)"}`,
                  background: period === p ? "var(--info-bg)" : "transparent",
                  color: "var(--text-strong)",
                  fontWeight: 500,
                }}
              >
                {p === "7d" ? "7 days" : "30 days"}
              </Link>
            ))}
          </div>
        }
      />

      {/* Funnel */}
      <Card title="Conversion funnel">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-4)" }}>
          <FunnelStage label="Visitors" value={funnel.visitors} />
          <FunnelStage label="Carts" value={funnel.carts} note={`${funnel.rates.viewToCart}% of visitors`} />
          <FunnelStage
            label="Orders"
            value={funnel.orders}
            note={`${funnel.rates.cartToOrder}% of carts · ${funnel.rates.viewToOrder}% overall`}
          />
        </div>
        <div style={{ marginTop: "var(--space-4)", fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
          Revenue this period:{" "}
          <span className="mono" style={{ color: "var(--text-strong)", fontWeight: 600 }}>
            {money(revenue, currency)}
          </span>
        </div>
      </Card>

      {/* Daily sales bars */}
      <Card title={`Daily sales · last ${period === "7d" ? 7 : 30} days`} style={{ marginTop: "var(--space-5)" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 120 }}>
          {daily.map((d) => (
            <div
              key={d.date}
              title={`${d.date}: ${money(d.sales, currency)} · ${d.orders} order${d.orders === 1 ? "" : "s"}`}
              style={{
                flex: 1,
                height: `${Math.max(2, (d.sales / maxDay) * 100)}%`,
                background: d.sales > 0 ? "var(--accent)" : "var(--surface-sunken)",
                borderRadius: "var(--radius-sm)",
                minHeight: 2,
              }}
            />
          ))}
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-5)", marginTop: "var(--space-5)", alignItems: "start" }}>
        {/* Attribution */}
        <Card title="Traffic sources">
          {referrers.length === 0 ? (
            <Empty>No traffic recorded yet.</Empty>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Source</th>
                  <th scope="col" className="col-right">Visits</th>
                  <th scope="col" className="col-right">Share</th>
                </tr>
              </thead>
              <tbody>
                {referrers.map((r) => (
                  <tr key={r.source}>
                    <td style={{ color: "var(--text-strong)" }}>{r.source}</td>
                    <td className="col-right num">{r.count}</td>
                    <td className="col-right num" style={{ color: "var(--text-muted)" }}>{r.pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        {/* Top products */}
        <Card title="Top products">
          {topProducts.length === 0 ? (
            <Empty>No sales in this period.</Empty>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Product</th>
                  <th scope="col" className="col-right">Units</th>
                  <th scope="col" className="col-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((p) => (
                  <tr key={p.title}>
                    <td style={{ color: "var(--text-strong)" }}>{p.title}</td>
                    <td className="col-right num">{p.units}</td>
                    <td className="col-right num">{money(p.revenue, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {/* Cohorts */}
      <Card title="Customer cohorts · repeat purchase rate" style={{ marginTop: "var(--space-5)" }}>
        {cohorts.length === 0 ? (
          <Empty>No customers yet.</Empty>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Joined</th>
                <th scope="col" className="col-right">Customers</th>
                <th scope="col" className="col-right">Repeat buyers</th>
                <th scope="col" className="col-right">Repeat rate</th>
              </tr>
            </thead>
            <tbody>
              {cohorts.map((c) => (
                <tr key={c.month}>
                  <td className="mono" style={{ color: "var(--text-strong)" }}>{c.month}</td>
                  <td className="col-right num">{c.count}</td>
                  <td className="col-right num">{c.repeat}</td>
                  <td className="col-right num">
                    <Pill tone={c.repeatRate >= 20 ? "success" : "muted"}>{c.repeatRate}%</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function FunnelStage({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div
      style={{
        padding: "var(--space-4)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        background: "var(--surface-subtle)",
      }}
    >
      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </div>
      <div className="mono" style={{ fontSize: "var(--text-2xl)", fontWeight: 600, color: "var(--text-strong)", marginTop: 4 }}>
        {value.toLocaleString()}
      </div>
      {note && <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: 4 }}>{note}</div>}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p style={{ padding: "var(--space-4)", color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>{children}</p>;
}
