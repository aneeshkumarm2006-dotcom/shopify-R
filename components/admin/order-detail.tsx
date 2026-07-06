"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Fulfillment, FulfillmentStatus, Order, PaymentStatus } from "@/types";
import {
  Avatar,
  Button,
  Card,
  Dropdown,
  Field,
  Icon,
  type IconName,
  Input,
  MenuItem,
  PageHeader,
  Pill,
  Stepper,
  Thumb,
  useToast,
  useConfirm,
} from "@/components/ui";
import { fulfillmentPill, paymentPill } from "@/components/admin/shared";
import { fulfillOrder, setOrderStatus, addOrderNoteAction } from "@/app/(admin)/orders/actions";
import type { TimelineKind } from "@/types";
import { fmtDate, fmtDateTime, money } from "@/lib/format";

/**
 * Only http(s) tracking URLs are linked — anything else (e.g. a `javascript:` URL
 * smuggled in from the data layer) is rendered as inert text so a malicious carrier
 * URL can never execute. Mirrors the storefront's link-safety discipline.
 */
function safeTrackingHref(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

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

/** Icon per persisted timeline-entry kind (Phase 6). */
const TIMELINE_ICON: Record<TimelineKind, IconName> = {
  created: "check",
  payment: "tag",
  fulfillment: "truck",
  status: "refresh",
  note: "list",
};

export function OrderDetail({
  order,
  customerId,
  currency = "$",
}: {
  order: Order;
  customerId: string;
  currency?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [, startTransition] = useTransition();
  const [payment, setPayment] = useState<PaymentStatus>(order.paymentStatus);
  const [fulfillment, setFulfillment] = useState<FulfillmentStatus>(
    order.fulfillmentStatus,
  );
  const [note, setNote] = useState("");
  const [events, setEvents] = useState<TimelineEvent[]>(() => {
    const fromTimeline = (order.timeline ?? []).map((t) => ({
      icon: TIMELINE_ICON[t.kind],
      label: t.message,
      time: t.at,
    }));
    return [
      { icon: "lock" as IconName, label: "Age verified (21+)", time: order.ageVerifiedAt },
      ...fromTimeline,
    ].sort((a, b) => (a.time < b.time ? 1 : -1)); // newest first
  });

  const pp = paymentPill(payment);
  const fp = fulfillmentPill(fulfillment);

  // Remaining-to-ship per line, derived from the snapshot quantities on the order.
  const remainingByLine = useMemo(
    () =>
      order.lineItems.map((l) =>
        Math.max(0, l.quantity - (l.fulfilledQuantity ?? 0)),
      ),
    [order.lineItems],
  );
  const totalRemaining = remainingByLine.reduce((s, r) => s + r, 0);
  const fulfillments = order.fulfillments ?? [];

  function logEvent(icon: IconName, label: string) {
    setEvents((e) => [{ icon, label, time: new Date().toISOString() }, ...e]);
  }

  function submitNote() {
    const body = note.trim();
    if (!body) return;
    logEvent("list", body); // optimistic
    setNote("");
    startTransition(async () => {
      const res = await addOrderNoteAction(order._id, body);
      if (!res.ok) toast(res.error ?? "Couldn't add the note", { tone: "critical" });
    });
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
                    onClick={async () => {
                      close();
                      const ok = await confirm({
                        title: "Mark payment refunded?",
                        message: "This records the order as refunded. Make sure the refund has actually been issued to the customer.",
                        confirmLabel: "Mark refunded",
                        destructive: true,
                      });
                      if (ok) changePayment("refunded", "Payment refunded");
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
                    onClick={async () => {
                      close();
                      const ok = await confirm({
                        title: "Cancel this order?",
                        message: "Cancelling marks the order as cancelled. This can’t be undone.",
                        confirmLabel: "Cancel order",
                        cancelLabel: "Keep order",
                        destructive: true,
                      });
                      if (ok) changeFulfillment("cancelled", "Order cancelled");
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
            {order.lineItems.map((l, i) => {
              const fulfilled = l.fulfilledQuantity ?? 0;
              const remaining = Math.max(0, l.quantity - fulfilled);
              return (
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
                  <div
                    style={{
                      fontSize: "var(--text-xs)",
                      color:
                        remaining === 0 ? "var(--success)" : "var(--text-muted)",
                      marginTop: 3,
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    <Icon
                      name={remaining === 0 ? "check" : "truck"}
                      size={12}
                      aria-hidden
                    />
                    {fulfilled} of {l.quantity} fulfilled
                    {remaining > 0 && (
                      <span style={{ color: "var(--text-faint, var(--text-muted))" }}>
                        · {remaining} remaining
                      </span>
                    )}
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
                  {money(l.price, currency)} × {l.quantity}
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
                  {money(l.price * l.quantity, currency)}
                </span>
              </div>
              );
            })}
            <div style={{ padding: "var(--space-3) var(--space-5)" }}>
              <TotalRow label="Subtotal" value={money(order.subtotal, currency)} />
              {(order.discountAmount ?? 0) > 0 && (
                <TotalRow
                  label={order.discountCode ? `Discount · ${order.discountCode}` : "Discount"}
                  value={`−${money(order.discountAmount ?? 0, currency)}`}
                />
              )}
              <TotalRow
                label={order.shippingMethod ? `Shipping · ${order.shippingMethod}` : "Shipping"}
                value={(order.shippingTotal ?? 0) > 0 ? money(order.shippingTotal ?? 0, currency) : "Free"}
              />
              {(order.taxTotal ?? 0) > 0 && (
                <TotalRow label="Tax" value={money(order.taxTotal ?? 0, currency)} />
              )}
              <TotalRow label="Total" value={money(order.total, currency)} strong />
            </div>
          </Card>

          {fulfillment !== "cancelled" && totalRemaining > 0 && (
            <FulfillPanel
              order={order}
              remainingByLine={remainingByLine}
              onFulfilled={(label) => {
                logEvent("truck", label);
                router.refresh();
              }}
            />
          )}

          {fulfillments.length > 0 && (
            <FulfillmentHistory order={order} fulfillments={fulfillments} />
          )}

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
              {/* Note composer (Phase 6) */}
              <div style={{ display: "flex", gap: 8, marginTop: "var(--space-2)" }}>
                <input
                  className="input"
                  value={note}
                  onChange={(ev) => setNote(ev.target.value)}
                  placeholder="Add a note…"
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter") {
                      ev.preventDefault();
                      submitNote();
                    }
                  }}
                  style={{ flex: 1 }}
                />
                <Button variant="default" onClick={submitNote} disabled={!note.trim()}>
                  Add
                </Button>
              </div>
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

/**
 * "Fulfill items" panel (PRD §6.7 / Phase 3). One row per line with units still to
 * ship — a quantity Stepper (default = remaining, clamped to remaining) plus shared
 * tracking fields. "Create shipment" records the lines with qty > 0 via the
 * `fulfillOrder` server action; the data layer re-clamps and recomputes status, so
 * we just refresh on success.
 */
function FulfillPanel({
  order,
  remainingByLine,
  onFulfilled,
}: {
  order: Order;
  remainingByLine: number[];
  onFulfilled: (label: string) => void;
}) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  // Default each shippable line to its full remaining quantity.
  const [qty, setQty] = useState<Record<number, number>>(() => {
    const init: Record<number, number> = {};
    remainingByLine.forEach((r, i) => {
      if (r > 0) init[i] = r;
    });
    return init;
  });
  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrier, setCarrier] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");

  const shippable = remainingByLine
    .map((r, i) => ({ i, r }))
    .filter(({ r }) => r > 0);
  const totalSelected = shippable.reduce((s, { i }) => s + (qty[i] ?? 0), 0);

  function submit() {
    const lines = shippable
      .map(({ i }) => ({ lineIndex: i, quantity: qty[i] ?? 0 }))
      .filter((l) => l.quantity > 0);
    if (lines.length === 0) {
      toast("Choose at least one item to fulfill.", { tone: "info" });
      return;
    }
    startTransition(async () => {
      const res = await fulfillOrder(order._id, {
        lines,
        trackingNumber: trackingNumber.trim() || undefined,
        carrier: carrier.trim() || undefined,
        trackingUrl: trackingUrl.trim() || undefined,
      });
      if (res.ok) {
        const units = lines.reduce((s, l) => s + l.quantity, 0);
        const label = `Fulfilled ${units} item${units === 1 ? "" : "s"}`;
        toast(label, { icon: "truck" });
        onFulfilled(label);
      } else {
        toast(res.error ?? "Couldn't fulfill this order. Please try again.", {
          tone: "critical",
        });
      }
    });
  }

  return (
    <Card title="Fulfill items" pad={false}>
      <div style={{ borderTop: "1px solid var(--border)" }}>
        {shippable.map(({ i, r }) => {
          const l = order.lineItems[i]!;
          return (
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
              <Thumb size={40} ratio="4 / 5" alt="" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 500,
                    color: "var(--text-strong)",
                    fontSize: "var(--text-sm)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {l.title}
                </div>
                <div
                  style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}
                >
                  {r} of {l.quantity} remaining
                </div>
              </div>
              <Stepper
                value={qty[i] ?? 0}
                min={0}
                max={r}
                onChange={(next) => setQty((q) => ({ ...q, [i]: next }))}
                aria-label={`Quantity to fulfill for ${l.title}`}
              />
            </div>
          );
        })}
      </div>

      <div
        style={{
          padding: "var(--space-4) var(--space-5)",
          display: "grid",
          gap: "var(--space-3)",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "var(--space-3)",
          }}
        >
          <Field label="Tracking number">
            {(p) => (
              <Input
                {...p}
                mono
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="1Z999AA1..."
              />
            )}
          </Field>
          <Field label="Carrier">
            {(p) => (
              <Input
                {...p}
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                placeholder="UPS, USPS, FedEx…"
              />
            )}
          </Field>
        </div>
        <Field
          label="Tracking URL"
          help="Link the customer can use to track the shipment (https://…)."
        >
          {(p) => (
            <Input
              {...p}
              type="url"
              inputMode="url"
              value={trackingUrl}
              onChange={(e) => setTrackingUrl(e.target.value)}
              placeholder="https://…"
            />
          )}
        </Field>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: "var(--space-3)",
          }}
        >
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
            {totalSelected} item{totalSelected === 1 ? "" : "s"} selected
          </span>
          <Button
            variant="primary"
            icon="truck"
            loading={pending}
            disabled={totalSelected === 0}
            onClick={submit}
          >
            Create shipment
          </Button>
        </div>
      </div>
    </Card>
  );
}

/** Shipment records for the order — which lines shipped + tracking + when. */
function FulfillmentHistory({
  order,
  fulfillments,
}: {
  order: Order;
  fulfillments: Fulfillment[];
}) {
  return (
    <Card title="Fulfillments" pad={false}>
      <div style={{ borderTop: "1px solid var(--border)" }}>
        {fulfillments.map((f, idx) => {
          const href = safeTrackingHref(f.trackingUrl);
          return (
            <div
              key={f.id || idx}
              style={{
                padding: "var(--space-4) var(--space-5)",
                borderBottom:
                  idx < fulfillments.length - 1
                    ? "1px solid var(--border)"
                    : undefined,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "var(--space-3)",
                }}
              >
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    fontSize: "var(--text-sm)",
                    fontWeight: 500,
                    color: "var(--text-strong)",
                  }}
                >
                  <Icon name="truck" size={14} aria-hidden />
                  Shipment
                  {fulfillments.length > 1 ? ` #${idx + 1}` : ""}
                </span>
                <span
                  style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}
                >
                  {fmtDateTime(f.createdAt)}
                </span>
              </div>

              <ul
                style={{
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                }}
              >
                {f.lines.map((line, li) => {
                  const item = order.lineItems[line.lineIndex];
                  return (
                    <li
                      key={li}
                      style={{
                        fontSize: "var(--text-sm)",
                        color: "var(--text)",
                        display: "flex",
                        gap: 6,
                      }}
                    >
                      <span className="mono" style={{ color: "var(--text-muted)" }}>
                        ×{line.quantity}
                      </span>
                      <span>{item ? item.title : `Item #${line.lineIndex + 1}`}</span>
                    </li>
                  );
                })}
              </ul>

              {(f.carrier || f.trackingNumber || href) && (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: 8,
                    fontSize: "var(--text-xs)",
                    color: "var(--text-muted)",
                  }}
                >
                  {f.carrier && <span>{f.carrier}</span>}
                  {f.trackingNumber && (
                    <span className="mono" style={{ color: "var(--text)" }}>
                      {f.trackingNumber}
                    </span>
                  )}
                  {href && (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        color: "var(--info)",
                        textDecoration: "none",
                      }}
                    >
                      Track shipment
                      <Icon name="external" size={12} aria-hidden />
                    </a>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
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
