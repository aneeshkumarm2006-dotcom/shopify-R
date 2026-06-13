import Link from "next/link";
import type { PlatformOrderRow } from "@/types";
import type { SettlementMethod } from "@/types";
import { cx, Eyebrow, PageHeader, Pill } from "@/components/ui";
import { paymentPill, fulfillmentPill } from "@/components/admin/shared";
import { money, fmtDateTime } from "@/lib/format";

/**
 * Platform operator Orders (operator P2) — a cross-tenant, read-only stream of every
 * order in the network. Filtering is server-driven via `?filter=` links (no client
 * state), mirroring the Activity feed. Rows flagged `stuck` (unpaid COD/in-store left
 * for too long) are highlighted so operators can triage them at a glance.
 */

export const ORDER_FILTERS = ["all", "stuck", "pending", "paid", "refunded"] as const;
export type OrderFilter = (typeof ORDER_FILTERS)[number];

const FILTER_LABEL: Record<OrderFilter, string> = {
  all: "All",
  stuck: "Stuck",
  pending: "Pending",
  paid: "Paid",
  refunded: "Refunded",
};

const SETTLEMENT_LABEL: Record<SettlementMethod, string> = {
  online: "Online",
  cod: "Cash on delivery",
  in_store: "In store",
};

function hrefForFilter(filter: OrderFilter): string {
  return filter === "all" ? "/platform/orders" : `/platform/orders?filter=${filter}`;
}

export function PlatformOrders({
  orders,
  activeFilter,
}: {
  orders: PlatformOrderRow[];
  activeFilter: OrderFilter;
}) {
  return (
    <div>
      <PageHeader
        title="Orders"
        meta="Cross-tenant order stream — read-only. Stuck rows are unpaid COD/in-store orders left too long."
      />

      <div
        role="group"
        aria-label="Filter orders"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 2,
          marginBottom: "var(--space-4)",
        }}
      >
        {ORDER_FILTERS.map((f) => (
          <Link
            key={f}
            href={hrefForFilter(f)}
            className={cx("viewtab", activeFilter === f && "active")}
            aria-current={activeFilter === f ? "true" : undefined}
          >
            {FILTER_LABEL[f]}
          </Link>
        ))}
      </div>

      <div style={{ marginBottom: "var(--space-3)" }}>
        <Eyebrow>
          {orders.length} {orders.length === 1 ? "order" : "orders"}
          {activeFilter !== "all" ? ` · ${FILTER_LABEL[activeFilter]}` : ""}
        </Eyebrow>
      </div>

      {orders.length === 0 ? (
        <div
          className="card"
          style={{
            padding: "var(--space-6) var(--space-5)",
            textAlign: "center",
            color: "var(--text-muted)",
            fontSize: "var(--text-sm)",
          }}
        >
          No orders match this filter.
        </div>
      ) : (
        <div className="card" style={{ overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Order #</th>
                  <th scope="col">Store</th>
                  <th scope="col" style={{ textAlign: "right" }}>
                    Total
                  </th>
                  <th scope="col">Payment</th>
                  <th scope="col">Fulfillment</th>
                  <th scope="col">Settlement</th>
                  <th scope="col">Date</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const pay = paymentPill(o.paymentStatus);
                  const ful = fulfillmentPill(o.fulfillmentStatus);
                  return (
                    <tr
                      key={o.id}
                      style={
                        o.stuck
                          ? { background: "var(--surface-warning, var(--surface-sunken))" }
                          : undefined
                      }
                    >
                      <td>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "var(--space-2)",
                          }}
                        >
                          <span
                            className="mono"
                            style={{ fontWeight: 500, color: "var(--text-strong)" }}
                          >
                            #{o.orderNumber}
                          </span>
                          {o.stuck && (
                            <Pill tone="warning" dot={false}>
                              Stuck
                            </Pill>
                          )}
                        </span>
                      </td>
                      <td>
                        <Link
                          href={`/platform/stores/${o.storeId}`}
                          style={{ color: "var(--text-strong)" }}
                        >
                          {o.storeName}
                        </Link>
                      </td>
                      <td className="mono" style={{ textAlign: "right" }}>
                        {money(o.total)}
                      </td>
                      <td>
                        <Pill tone={pay.tone}>{pay.label}</Pill>
                      </td>
                      <td>
                        <Pill tone={ful.tone}>{ful.label}</Pill>
                      </td>
                      <td>
                        <span style={{ color: "var(--text-muted)" }}>
                          {SETTLEMENT_LABEL[o.settlementMethod]}
                        </span>
                      </td>
                      <td>
                        <span style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                          {fmtDateTime(o.createdAt)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
