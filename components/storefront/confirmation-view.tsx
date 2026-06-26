"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { money } from "@/lib/format";
import { STORE_HOME } from "./shared";
import { useStoreHref } from "./storefront-context";
import { readOrder, type PlacedOrder } from "./order-handoff";

/** Customer-facing labels for the settlement-method echo. */
const SETTLEMENT_LABEL: Record<NonNullable<PlacedOrder["settlementMethod"]>, string> = {
  online: "Pay online",
  cod: "Cash on delivery",
  in_store: "Pay in store",
};

/** One label/value row in the confirmation summary breakdown. */
function ConfirmLine({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        marginBottom: 8,
        fontSize: "var(--text-base)",
        color: accent ? "var(--accent-pressed)" : "var(--text)",
      }}
    >
      <span>{label}</span>
      <span className="mono" style={{ whiteSpace: "nowrap", color: accent ? undefined : "var(--text-strong)" }}>
        {value}
      </span>
    </div>
  );
}

/**
 * Order confirmation (DESIGN §5.4) — success state with the mono order number, a
 * summary echo, and a calm "what happens next" timeline (payment is arranged offline
 * in MVP). Reads the Part A handoff stashed at checkout; Stage 10 reads the real order.
 */
export function ConfirmationView() {
  const href = useStoreHref();
  const [order, setOrder] = useState<PlacedOrder | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setOrder(readOrder());
  }, []);

  const orderLabel = order ? `#${order.orderNumber}` : "#1043";

  return (
    <div
      className="store-container"
      style={{ maxWidth: 620, paddingTop: "var(--space-20)", paddingBottom: "var(--space-20)", textAlign: "center" }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "var(--lime-100)",
          border: "1px solid var(--lime-200)",
          display: "grid",
          placeItems: "center",
          margin: "0 auto 24px",
          color: "var(--accent-pressed)",
        }}
      >
        <Icon name="check" size={28} aria-hidden />
      </div>
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 600,
          fontSize: "var(--text-2xl)",
          color: "var(--warm-900)",
          letterSpacing: "-0.01em",
        }}
      >
        Order placed
      </h1>
      <p style={{ marginTop: 14, fontSize: "var(--text-md)", color: "var(--text)", lineHeight: 1.6 }}>
        Thank you. Your order{" "}
        <span className="mono" style={{ color: "var(--warm-900)", fontWeight: 500 }}>
          {orderLabel}
        </span>{" "}
        is confirmed. We&rsquo;ll email you shortly to arrange delivery and payment.
      </p>

      {/* Summary echo (Part A — from the checkout handoff). */}
      {mounted && order && order.items.length > 0 && (
        <div
          style={{
            marginTop: 28,
            padding: "var(--space-6)",
            background: "var(--warm-0)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            textAlign: "left",
          }}
        >
          {order.items.map((it, i) => (
            <div
              key={i}
              style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 8, fontSize: "var(--text-base)" }}
            >
              <span style={{ color: "var(--text)" }}>
                {it.title}
                {it.variant ? ` · ${it.variant}` : ""} × {it.quantity}
              </span>
              <span className="mono" style={{ color: "var(--text-strong)", whiteSpace: "nowrap" }}>
                {money(it.price * it.quantity, order.currency)}
              </span>
            </div>
          ))}
          <hr className="divider" style={{ margin: "12px 0" }} />
          {typeof order.subtotal === "number" && (
            <ConfirmLine label="Subtotal" value={money(order.subtotal, order.currency)} />
          )}
          {order.discount && (
            <ConfirmLine
              label={`Discount · ${order.discount.code}`}
              value={`−${money(order.discount.amount, order.currency)}`}
              accent
            />
          )}
          {order.shipping && (
            <ConfirmLine
              label={`Shipping${order.shipping.method ? ` · ${order.shipping.method}` : ""}`}
              value={order.shipping.amount > 0 ? money(order.shipping.amount, order.currency) : "Free"}
            />
          )}
          {order.tax && order.tax.amount > 0 && (
            <ConfirmLine label={order.tax.label} value={money(order.tax.amount, order.currency)} />
          )}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <span style={{ fontWeight: 600, color: "var(--warm-900)" }}>Total</span>
            <span className="mono" style={{ fontWeight: 600, color: "var(--warm-900)" }}>
              {money(order.total, order.currency)}
            </span>
          </div>
          {order.settlementMethod && (
            <div
              style={{
                marginTop: 12,
                fontSize: "var(--text-sm)",
                color: "var(--warm-600)",
              }}
            >
              Payment method: {SETTLEMENT_LABEL[order.settlementMethod]}
            </div>
          )}
        </div>
      )}

      <div
        style={{
          marginTop: 28,
          padding: "var(--space-6)",
          background: "var(--warm-0)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          textAlign: "left",
        }}
      >
        <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--warm-900)", marginBottom: 12 }}>
          What happens next
        </div>
        {[
          "We confirm stock and delivery window by email",
          "Payment is arranged securely on delivery",
          "Age & ID verified at the door (21+)",
        ].map((t, i) => (
          <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10, fontSize: "var(--text-base)", color: "var(--text)" }}>
            <span className="mono" style={{ color: "var(--accent-pressed)" }}>
              {i + 1}.
            </span>
            {t}
          </div>
        ))}
      </div>

      <Link
        href={href(STORE_HOME)}
        className="btn btn-lg btn-pill"
        style={{ marginTop: 28, background: "var(--warm-900)", color: "var(--warm-50)" }}
      >
        Continue shopping
      </Link>
    </div>
  );
}
