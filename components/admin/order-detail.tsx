"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FulfillmentStatus, Order, PaymentStatus } from "@/types";
import {
  Avatar,
  Button,
  Card,
  Dropdown,
  Icon,
  type IconName,
  MenuItem,
  PageHeader,
  Pill,
  Thumb,
  useToast,
} from "@/components/ui";
import { fulfillmentPill, paymentPill } from "@/components/admin/shared";
import { setOrderStatus } from "@/app/(admin)/orders/actions";
import { fmtDate, fmtDateTime, money } from "@/lib/format";

/**
 * Order detail (DESIGN §4.7). Line-item SNAPSHOTS (frozen at purchase, never live
 * product refs — a "snapshot" affordance makes this explicit), customer + shipping
 * blocks, the age-verified timestamp, manual payment/fulfillment controls (split
 * buttons, optimistic + toast), and an event timeline. Status changes are local.
 */

interface TimelineEvent {
  icon: IconName;
  label: string;
  time: string;
}

export function OrderDetail({ order, customerId }: { order: Order; customerId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();
  const [payment, setPayment] = useState<PaymentStatus>(order.paymentStatus);
  const [fulfillment, setFulfillment] = useState<FulfillmentStatus>(
    order.fulfillmentStatus,
  );
  const [events, setEvents] = useState<TimelineEvent[]>(() => [
    { icon: "lock", label: "Age verified (21+)", time: order.ageVerifiedAt },
    { icon: "check", label: "Order placed", time: order.createdAt },
  ]);

  const pp = paymentPill(payment);
  const fp = fulfillmentPill(fulfillment);

  function logEvent(icon: IconName, label: string) {
    setEvents((e) => [{ icon, label, time: new Date().toISOString() }, ...e]);
  }

  /**
   * Optimistically reflect the status change, then persist it (PRD §6.7). On a
   * failure we roll the UI back to the previous value and surface a toast, so the
   * displayed status never drifts from what's saved.
   */
  function persist(
    patch: { paymentStatus?: PaymentStatus; fulfillmentStatus?: FulfillmentStatus },
    rollback: () => void,
    icon: IconName,
    label: string,
  ) {
    logEvent(icon, label);
    startTransition(async () => {
      const res = await setOrderStatus(order._id, patch);
      if (res.ok) {
        toast(label);
      } else {
        rollback();
        toast("Couldn't update the order. Please try again.", { tone: "critical" });
      }
    });
  }

  function changePayment(next: PaymentStatus, label: string) {
    const prev = payment;
    setPayment(next);
    persist({ paymentStatus: next }, () => setPayment(prev), "tag", label);
  }
  function changeFulfillment(next: FulfillmentStatus, label: string) {
    const prev = fulfillment;
    setFulfillment(next);
    persist({ fulfillmentStatus: next }, () => setFulfillment(prev), "truck", label);
  }

  return (
    <div>
      <PageHeader
        breadcrumb={
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            style={{ padding: "0 6px", marginLeft: -6, color: "var(--text-muted)" }}
            onClick={() => router.push("/orders")}
          >
            <Icon name="chevronLeft" size={15} aria-hidden /> Orders
          </button>
        }
        title={`Order #${order.orderNumber}`}
        pill={
          <div style={{ display: "flex", gap: 6 }}>
            <Pill tone={pp.tone}>{pp.label}</Pill>
            <Pill tone={fp.tone}>{fp.label}</Pill>
          </div>
        }
        meta={
          <span>
            Placed {fmtDate(order.createdAt)} ·{" "}
            <span style={{ color: "var(--success)" }}>
              Age verified ✓ {fmtDateTime(order.ageVerifiedAt)}
            </span>
          </span>
        }
        actions={
          <>
            <Dropdown
              trigger={
                <Button
                  variant="default"
                  iconRight="chevronDown"
                  disabled={payment === "paid"}
                >
                  Mark as paid
                </Button>
              }
            >
              {(close) => (
                <>
                  <MenuItem
                    onClick={() => {
                      changePayment("paid", "Payment marked paid");
                      close();
                    }}
                  >
                    Paid
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      changePayment("refunded", "Payment refunded");
                      close();
                    }}
                  >
                    Refunded
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      changePayment("pending", "Payment set pending");
                      close();
                    }}
                  >
                    Pending
                  </MenuItem>
                </>
              )}
            </Dropdown>
            <Dropdown
              trigger={
                <Button variant="primary" iconRight="chevronDown">
                  Fulfill
                </Button>
              }
            >
              {(close) => (
                <>
                  <MenuItem
                    onClick={() => {
                      changeFulfillment("fulfilled", "Order fulfilled");
                      close();
                    }}
                  >
                    Mark fulfilled
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      changeFulfillment("unfulfilled", "Marked unfulfilled");
                      close();
                    }}
                  >
                    Mark unfulfilled
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      changeFulfillment("cancelled", "Order cancelled");
                      close();
                    }}
                  >
                    Cancel order
                  </MenuItem>
                </>
              )}
            </Dropdown>
          </>
        }
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.7fr 1fr",
          gap: "var(--space-5)",
          alignItems: "start",
        }}
      >
        {/* Line items */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
          <Card pad={false}>
            <div
              style={{
                padding: "var(--space-4) var(--space-5)",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span className="card-title" style={{ fontSize: "var(--text-base)" }}>
                Items
              </span>
              <span className="tip" data-tip="Prices are snapshots from purchase time">
                <Pill tone="muted" dot={false}>
                  snapshot
                </Pill>
              </span>
            </div>
            {order.lineItems.map((l, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-3)",
                  padding: "var(--space-3) var(--space-5)",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <Thumb size={44} ratio="4 / 5" alt="" />
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontWeight: 500,
                      color: "var(--text-strong)",
                      fontSize: "var(--text-sm)",
                    }}
                  >
                    {l.title}
                  </div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                    {l.variant} · <span className="mono">{l.sku}</span>
                  </div>
                </div>
                <span
                  className="mono"
                  style={{
                    color: "var(--text-muted)",
                    fontSize: "var(--text-sm)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {money(l.price)} × {l.quantity}
                </span>
                <span
                  className="mono"
                  style={{
                    color: "var(--text-strong)",
                    fontSize: "var(--text-sm)",
                    width: 72,
                    textAlign: "right",
                    fontWeight: 500,
                  }}
                >
                  {money(l.price * l.quantity)}
                </span>
              </div>
            ))}
            <div style={{ padding: "var(--space-3) var(--space-5)" }}>
              <TotalRow label="Subtotal" value={money(order.subtotal)} />
              <TotalRow label="Total" value={money(order.total)} strong />
              <div
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--text-muted)",
                  marginTop: 6,
                }}
              >
                No tax or shipping engine in MVP
              </div>
            </div>
          </Card>

          <Card title="Timeline" pad={false}>
            <div
              style={{
                padding: "var(--space-4) var(--space-6)",
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-4)",
              }}
            >
              {events.map((e, i) => (
                <div
                  key={i}
                  style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}
                >
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: "var(--surface-sunken)",
                      color: "var(--text-muted)",
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Icon name={e.icon} size={14} aria-hidden />
                  </span>
                  <span
                    style={{
                      flex: 1,
                      fontSize: "var(--text-sm)",
                      color: "var(--text-strong)",
                    }}
                  >
                    {e.label}
                  </span>
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                    {fmtDateTime(e.time)}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Side blocks */}
        <Card pad={false}>
          <SideBlock icon="user" title="Customer">
            <Link
              href={`/customers/${customerId}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                textDecoration: "none",
              }}
            >
              <Avatar name={order.contact.name} size={30} />
              <div>
                <div
                  style={{
                    fontWeight: 500,
                    color: "var(--text-strong)",
                    fontSize: "var(--text-sm)",
                  }}
                >
                  {order.contact.name}
                </div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--info)" }}>
                  {order.contact.email}
                </div>
              </div>
            </Link>
          </SideBlock>
          <hr className="divider" />
          <SideBlock icon="mapPin" title="Shipping address">
            <div
              style={{ fontSize: "var(--text-sm)", color: "var(--text)", lineHeight: 1.5 }}
            >
              {order.shippingAddress.name}
              <br />
              {order.shippingAddress.address}
            </div>
          </SideBlock>
          <hr className="divider" />
          <SideBlock icon="phone" title="Contact">
            <div style={{ fontSize: "var(--text-sm)", color: "var(--text)" }}>
              {order.contact.phone ? (
                <span className="mono">{order.contact.phone}</span>
              ) : (
                "—"
              )}
            </div>
          </SideBlock>
          <hr className="divider" />
          <SideBlock icon="lock" title="Age verification">
            <div
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--success)",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Icon name="check" size={14} aria-hidden />
              <span className="mono" style={{ fontSize: "var(--text-xs)" }}>
                {fmtDateTime(order.ageVerifiedAt)}
              </span>
            </div>
          </SideBlock>
        </Card>
      </div>
    </div>
  );
}

function TotalRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "7px 0",
        fontSize: "var(--text-sm)",
      }}
    >
      <span
        style={{
          color: strong ? "var(--text-strong)" : "var(--text-muted)",
          fontWeight: strong ? 600 : 400,
        }}
      >
        {label}
      </span>
      <span
        className="mono"
        style={{ color: "var(--text-strong)", fontWeight: strong ? 600 : 400 }}
      >
        {value}
      </span>
    </div>
  );
}

function SideBlock({
  icon,
  title,
  children,
}: {
  icon: IconName;
  title: string;
  children: ReactNode;
}) {
  return (
    <div style={{ padding: "var(--space-4) var(--space-5)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
        <Icon name={icon} size={14} style={{ color: "var(--text-muted)" }} aria-hidden />
        <span className="eyebrow">{title}</span>
      </div>
      {children}
    </div>
  );
}
