"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Customer, Order } from "@/types";
import { Avatar, Card, Icon, PageHeader, Pill } from "@/components/ui";
import { fulfillmentPill, paymentPill } from "@/components/admin/shared";
import { fmtDate, money } from "@/lib/format";

/**
 * Customer detail (DESIGN §4.8) — header (name + contact), denormalized stats
 * (orders, total spent), order history, and saved addresses. Denormalized totals
 * mirror PRD §5.9; order history links into each order's detail.
 */
export function CustomerDetail({
  customer,
  orders,
}: {
  customer: Customer;
  orders: Order[];
}) {
  const router = useRouter();

  return (
    <div>
      <PageHeader
        breadcrumb={
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            style={{ padding: "0 6px", marginLeft: -6, color: "var(--text-muted)" }}
            onClick={() => router.push("/customers")}
          >
            <Icon name="chevronLeft" size={15} aria-hidden /> Customers
          </button>
        }
        title={
          <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Avatar name={customer.name} size={32} />
            {customer.name}
          </span>
        }
        meta={
          <span>
            <span style={{ color: "var(--info)" }}>{customer.email}</span>
            {customer.phone && (
              <>
                {" "}
                · <span className="mono">{customer.phone}</span>
              </>
            )}{" "}
            · Joined {fmtDate(customer.createdAt)}
          </span>
        }
      />

      {/* Denormalized stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "var(--space-4)",
          marginBottom: "var(--space-5)",
        }}
      >
        <Card>
          <div className="stat-label">Orders</div>
          <div className="stat-value mono">{customer.orderCount}</div>
        </Card>
        <Card>
          <div className="stat-label">Total spent</div>
          <div className="stat-value mono">{money(customer.totalSpent)}</div>
        </Card>
        <Card>
          <div className="stat-label">Saved addresses</div>
          <div className="stat-value mono">{customer.addresses.length}</div>
        </Card>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.6fr 1fr",
          gap: "var(--space-5)",
          alignItems: "start",
        }}
      >
        {/* Order history */}
        <Card title="Order history" pad={false}>
          {orders.length === 0 ? (
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
            orders.map((o) => {
              const pp = paymentPill(o.paymentStatus);
              const fp = fulfillmentPill(o.fulfillmentStatus);
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
                    style={{
                      flex: 1,
                      fontSize: "var(--text-sm)",
                      color: "var(--text-muted)",
                    }}
                  >
                    {fmtDate(o.createdAt)}
                  </span>
                  <span style={{ display: "flex", gap: 6 }}>
                    <Pill tone={pp.tone}>{pp.label}</Pill>
                    <Pill tone={fp.tone}>{fp.label}</Pill>
                  </span>
                  <span
                    className="mono"
                    style={{
                      fontSize: "var(--text-sm)",
                      color: "var(--text-strong)",
                      width: 72,
                      textAlign: "right",
                    }}
                  >
                    {money(o.total)}
                  </span>
                </Link>
              );
            })
          )}
        </Card>

        {/* Saved addresses */}
        <Card title="Saved addresses" pad={false}>
          {customer.addresses.length === 0 ? (
            <div
              style={{
                padding: "var(--space-6)",
                color: "var(--text-muted)",
                fontSize: "var(--text-sm)",
              }}
            >
              No saved addresses.
            </div>
          ) : (
            customer.addresses.map((a, i) => (
              <div
                key={i}
                style={{
                  padding: "var(--space-4) var(--space-6)",
                  borderTop: i ? "1px solid var(--border)" : "none",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}
                >
                  <Icon
                    name="mapPin"
                    size={14}
                    style={{ color: "var(--text-muted)" }}
                    aria-hidden
                  />
                  <span
                    style={{
                      fontWeight: 500,
                      color: "var(--text-strong)",
                      fontSize: "var(--text-sm)",
                    }}
                  >
                    {a.name}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: "var(--text-sm)",
                    color: "var(--text)",
                    lineHeight: 1.5,
                  }}
                >
                  {a.address}
                </div>
                {a.phone && (
                  <div
                    className="mono"
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--text-muted)",
                      marginTop: 4,
                    }}
                  >
                    {a.phone}
                  </div>
                )}
              </div>
            ))
          )}
        </Card>
      </div>
    </div>
  );
}
