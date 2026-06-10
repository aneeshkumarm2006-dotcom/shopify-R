"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { DashboardStats, Order, Store } from "@/types";
import type { InventoryRow } from "@/lib/data";
import {
  Button,
  Card,
  Eyebrow,
  Icon,
  PageHeader,
  Pill,
  Thumb,
  ViewTabs,
  useToast,
} from "@/components/ui";
import { paymentPill, storeStatusPill } from "@/components/admin/shared";
import { PublishDialog } from "@/components/admin/publish-dialog";
import { publishStoreAction } from "@/app/(admin)/publish/actions";
import { money, storeDomain } from "@/lib/format";

/**
 * Dashboard / Home (DESIGN §4.4) — minimal analytics per PRD §6.9. A publish nudge
 * (draft) or live banner, a period toggle, three stat cards with deltas, and two
 * panels: recent orders + low-stock alerts. Resist adding more reporting here.
 */

interface DashboardProps {
  store: Store;
  stats: DashboardStats;
  recentOrders: Order[];
  lowStock: InventoryRow[];
  activeProductCount: number;
}

function StatCard({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta: number;
}) {
  const up = delta >= 0;
  return (
    <Card>
      <div className="stat-label">{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <div className="stat-value mono">{value}</div>
        <span
          style={{
            fontSize: "var(--text-xs)",
            fontWeight: 600,
            color: up ? "var(--success)" : "var(--critical)",
            display: "flex",
            alignItems: "center",
            gap: 2,
          }}
        >
          <Icon name={up ? "chevronUp" : "chevronDown"} size={13} aria-hidden />
          {Math.abs(delta)}%
        </span>
      </div>
    </Card>
  );
}

export function Dashboard({
  store,
  stats,
  recentOrders,
  lowStock,
  activeProductCount,
}: DashboardProps) {
  const [range, setRange] = useState("7d");
  const [status, setStatus] = useState(store.status);
  const [publishOpen, setPublishOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const pill = storeStatusPill(status);

  function confirmPublish() {
    startTransition(async () => {
      const res = await publishStoreAction();
      if (res.ok && res.status) {
        setStatus(res.status);
        setPublishOpen(false);
        toast("Store published", { icon: "sparkle" });
        router.refresh();
      } else {
        toast(res.error ?? "Couldn't publish the store", { tone: "critical" });
      }
    });
  }

  return (
    <div>
      <PageHeader
        title="Home"
        pill={<Pill tone={pill.tone}>{pill.label}</Pill>}
        actions={
          status === "draft" ? (
            <Button variant="primary" icon="sparkle" onClick={() => setPublishOpen(true)}>
              Publish store
            </Button>
          ) : (
            <Button
              variant="default"
              iconRight="external"
              onClick={() => window.open(`https://${storeDomain(store.subdomain)}`, "_blank")}
            >
              View store
            </Button>
          )
        }
      />

      {/* Publish nudge (draft) or live banner */}
      {status === "draft" ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-4)",
            padding: "var(--space-4) var(--space-5)",
            background: "var(--accent-tint)",
            border: "1px solid color-mix(in oklab, var(--accent) 40%, var(--border))",
            borderRadius: "var(--radius-lg)",
            marginBottom: "var(--space-6)",
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: "var(--radius-md)",
              background: "var(--accent)",
              display: "grid",
              placeItems: "center",
              color: "var(--text-on-accent)",
              flexShrink: 0,
            }}
          >
            <Icon name="leaf" size={18} aria-hidden />
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontWeight: 600,
                color: "var(--text-strong)",
                fontSize: "var(--text-sm)",
              }}
            >
              Your store isn’t live yet
            </div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--warm-700)" }}>
              Subdomain claimed · {activeProductCount} active product
              {activeProductCount === 1 ? "" : "s"} · Age gate on
            </div>
          </div>
          <Button
            variant="primary"
            size="sm"
            icon="sparkle"
            onClick={() => setPublishOpen(true)}
          >
            Publish
          </Button>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-4)",
            padding: "var(--space-4) var(--space-5)",
            background: "var(--accent-tint)",
            border: "1px solid color-mix(in oklab, var(--accent) 40%, var(--border))",
            borderRadius: "var(--radius-lg)",
            marginBottom: "var(--space-6)",
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: "var(--radius-md)",
              background: "var(--accent)",
              display: "grid",
              placeItems: "center",
              color: "var(--text-on-accent)",
              flexShrink: 0,
            }}
          >
            <Icon name="leaf" size={18} aria-hidden />
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontWeight: 600,
                color: "var(--text-strong)",
                fontSize: "var(--text-sm)",
              }}
            >
              Your store is live at {storeDomain(store.subdomain)}
            </div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--warm-700)" }}>
              Subdomain claimed · {activeProductCount} active product
              {activeProductCount === 1 ? "" : "s"} · Age gate on
            </div>
          </div>
          <Button
            variant="default"
            size="sm"
            iconRight="external"
            onClick={() => window.open(`https://${storeDomain(store.subdomain)}`, "_blank")}
          >
            View store
          </Button>
        </div>
      )}

      {/* Period toggle */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "var(--space-4)",
        }}
      >
        <Eyebrow>Overview</Eyebrow>
        <ViewTabs
          aria-label="Reporting period"
          tabs={[
            { value: "Today", label: "Today" },
            { value: "7d", label: "7d" },
            { value: "30d", label: "30d" },
          ]}
          active={range}
          onChange={setRange}
        />
      </div>

      {/* Stat cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "var(--space-4)",
          marginBottom: "var(--space-6)",
        }}
      >
        <StatCard label="Total sales" value={money(stats.sales)} delta={stats.salesDelta} />
        <StatCard label="Orders" value={String(stats.orders)} delta={stats.ordersDelta} />
        <StatCard
          label="Customers"
          value={String(stats.customers)}
          delta={stats.customersDelta}
        />
      </div>

      {/* Recent orders + low stock */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr",
          gap: "var(--space-4)",
          alignItems: "start",
        }}
      >
        <Card
          title="Recent orders"
          pad={false}
          action={
            <Link
              href="/orders"
              className="btn btn-sm btn-ghost"
              style={{ color: "var(--accent-pressed)" }}
            >
              View all
            </Link>
          }
        >
          {recentOrders.length === 0 ? (
            <div
              style={{
                padding: "var(--space-6)",
                color: "var(--text-muted)",
                fontSize: "var(--text-sm)",
              }}
            >
              No orders yet.
            </div>
          ) : (
            recentOrders.slice(0, 5).map((o) => {
              const pp = paymentPill(o.paymentStatus);
              return (
                <Link key={o._id} href={`/orders/${o._id}`} className="list-row">
                  <span
                    className="mono"
                    style={{
                      fontSize: "var(--text-sm)",
                      color: "var(--text-strong)",
                      width: 52,
                    }}
                  >
                    #{o.orderNumber}
                  </span>
                  <span
                    style={{ flex: 1, fontSize: "var(--text-sm)", color: "var(--text)" }}
                  >
                    {o.contact.name}
                  </span>
                  <span
                    className="mono"
                    style={{ fontSize: "var(--text-sm)", color: "var(--text-strong)" }}
                  >
                    {money(o.total)}
                  </span>
                  <span style={{ width: 96, display: "flex", justifyContent: "flex-end" }}>
                    <Pill tone={pp.tone}>{pp.label}</Pill>
                  </span>
                </Link>
              );
            })
          )}
        </Card>

        <Card
          title={
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              Low-stock alerts
              {lowStock.length > 0 && (
                <Pill tone="warning" dot={false}>
                  {lowStock.length}
                </Pill>
              )}
            </span>
          }
          pad={false}
          action={
            <Link
              href="/inventory"
              className="btn btn-sm btn-ghost"
              style={{ color: "var(--accent-pressed)" }}
            >
              Inventory
            </Link>
          }
        >
          {lowStock.length === 0 ? (
            <div
              style={{
                padding: "var(--space-6)",
                color: "var(--text-muted)",
                fontSize: "var(--text-sm)",
              }}
            >
              Everything’s in stock.
            </div>
          ) : (
            lowStock.map((r) => (
              <Link key={r.productId + r.variant.id} href="/inventory" className="list-row">
                <Thumb size={30} alt="" />
                <span
                  style={{
                    flex: 1,
                    fontSize: "var(--text-sm)",
                    color: "var(--text-strong)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {r.productTitle}
                  {r.variant.title !== "Default" && (
                    <span style={{ color: "var(--text-muted)" }}> · {r.variant.title}</span>
                  )}
                </span>
                <span
                  className="mono"
                  style={{
                    fontSize: "var(--text-xs)",
                    fontWeight: 500,
                    color: r.status === "out" ? "var(--critical)" : "var(--warning)",
                  }}
                >
                  {r.onHand === 0 ? "0 left" : `${r.onHand} left`}
                </span>
              </Link>
            ))
          )}
        </Card>
      </div>

      <PublishDialog
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        store={store}
        activeProductCount={activeProductCount}
        pending={pending}
        onConfirm={confirmPublish}
      />
    </div>
  );
}
