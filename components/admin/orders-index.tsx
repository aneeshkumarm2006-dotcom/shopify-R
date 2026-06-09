"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Order } from "@/types";
import { EmptyState, NoResultsState, PageHeader, Pill } from "@/components/ui";
import { IndexShell } from "@/components/admin/index-shell";
import { fulfillmentPill, paymentPill } from "@/components/admin/shared";
import { fmtDate, money } from "@/lib/format";

/**
 * Orders index (DESIGN §4.7) — All/Unfulfilled/Unpaid view tabs over the index
 * table: order # (mono, sequential) · date · customer · total (mono) · payment
 * pill · fulfillment pill. Search by # or email. Row → order detail.
 */
export function OrdersIndex({ orders }: { orders: Order[] }) {
  const router = useRouter();
  const [tab, setTab] = useState("All");
  const [query, setQuery] = useState("");

  const counts = useMemo(
    () => ({
      All: orders.length,
      Unfulfilled: orders.filter((o) => o.fulfillmentStatus === "unfulfilled").length,
      Unpaid: orders.filter((o) => o.paymentStatus === "pending").length,
    }),
    [orders],
  );

  const rows = useMemo(() => {
    let r = orders;
    if (tab === "Unfulfilled") r = r.filter((o) => o.fulfillmentStatus === "unfulfilled");
    if (tab === "Unpaid") r = r.filter((o) => o.paymentStatus === "pending");
    const q = query.trim().toLowerCase();
    if (q) {
      r = r.filter(
        (o) =>
          `#${o.orderNumber}`.includes(q) ||
          o.contact.email.toLowerCase().includes(q) ||
          o.contact.name.toLowerCase().includes(q),
      );
    }
    return r;
  }, [orders, tab, query]);

  return (
    <div>
      <PageHeader title="Orders" />
      <IndexShell
        tabsLabel="Filter orders"
        tabs={[
          { value: "All", label: "All", count: counts.All },
          { value: "Unfulfilled", label: "Unfulfilled", count: counts.Unfulfilled },
          { value: "Unpaid", label: "Unpaid", count: counts.Unpaid },
        ]}
        active={tab}
        onTabChange={setTab}
        query={query}
        onQueryChange={setQuery}
        searchPlaceholder="Search by # or email"
      >
        {orders.length === 0 ? (
          <EmptyState
            icon="orders"
            title="No orders yet"
            body="Orders will appear here as customers check out on your storefront."
          />
        ) : rows.length === 0 ? (
          <NoResultsState
            onClear={() => {
              setQuery("");
              setTab("All");
            }}
          />
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Order</th>
                <th scope="col">Date</th>
                <th scope="col">Customer</th>
                <th scope="col" className="col-right">
                  Total
                </th>
                <th scope="col">Payment</th>
                <th scope="col">Fulfillment</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => {
                const pp = paymentPill(o.paymentStatus);
                const fp = fulfillmentPill(o.fulfillmentStatus);
                return (
                  <tr
                    key={o._id}
                    className="is-clickable"
                    onClick={() => router.push(`/orders/${o._id}`)}
                  >
                    <td>
                      <span
                        className="mono"
                        style={{ fontWeight: 500, color: "var(--text-strong)" }}
                      >
                        #{o.orderNumber}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: "var(--text-muted)" }}>
                        {fmtDate(o.createdAt)}
                      </span>
                    </td>
                    <td>{o.contact.name}</td>
                    <td className="col-right num">
                      <span style={{ color: "var(--text-strong)" }}>{money(o.total)}</span>
                    </td>
                    <td>
                      <Pill tone={pp.tone}>{pp.label}</Pill>
                    </td>
                    <td>
                      <Pill tone={fp.tone}>{fp.label}</Pill>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </IndexShell>
    </div>
  );
}
