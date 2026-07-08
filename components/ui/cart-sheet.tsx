"use client";

import { Sheet } from "./sheet";
import { Button } from "./button";
import { IconButton } from "./icon-button";
import { Stepper } from "./stepper";
import { Thumb } from "./thumb";
import { EmptyState } from "./states";

/**
 * Cart sheet (DESIGN §5.4, §3.7) — 420px right slide-in. Empty state, item rows
 * with a quantity stepper + remove, mono subtotal, and a pill Checkout CTA.
 * Presentational + controlled: the real cart seam (Stage 10) drives `items`.
 * No discount field (out of scope, DESIGN §8).
 */
export interface CartLine {
  id: string;
  title: string;
  variant?: string;
  price: number; // unit price snapshot
  quantity: number;
  image?: string | null;
}

export interface CartSheetProps {
  open: boolean;
  onClose: () => void;
  items: CartLine[];
  currency?: string;
  /** Free-shipping threshold (drives the progress meter). Null/absent hides it. */
  freeShippingThreshold?: number | null;
  /** Cart subtotal from context (authoritative). Falls back to summing `items`. */
  subtotal?: number;
  onQuantityChange?: (id: string, quantity: number) => void;
  onRemove?: (id: string) => void;
  onCheckout?: () => void;
  onContinue?: () => void;
}

function money(n: number, currency: string) {
  return `${currency}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function CartSheet({
  open,
  onClose,
  items,
  currency = "$",
  freeShippingThreshold,
  subtotal: subtotalProp,
  onQuantityChange,
  onRemove,
  onCheckout,
  onContinue,
}: CartSheetProps) {
  const subtotal = subtotalProp ?? items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const count = items.reduce((sum, i) => sum + i.quantity, 0);
  const empty = items.length === 0;

  // Free-shipping meter: how far the subtotal is from unlocking free shipping.
  const threshold = freeShippingThreshold ?? 0;
  const showMeter = threshold > 0 && !empty;
  const remaining = Math.max(0, threshold - subtotal);
  const unlocked = subtotal >= threshold;
  const pct = threshold > 0 ? Math.min(100, Math.round((subtotal / threshold) * 100)) : 0;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      width={420}
      title={`Your cart${count ? ` · ${count}` : ""}`}
      footer={
        empty ? undefined : (
          <>
            <div className="cart-subtotal">
              <span style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>
                Subtotal
              </span>
              <span className="amt">{money(subtotal, currency)}</span>
            </div>
            <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", margin: 0 }}>
              Shipping calculated at checkout.
            </p>
            <Button variant="primary" size="lg" pill block onClick={onCheckout}>
              Checkout
            </Button>
          </>
        )
      }
    >
      {empty ? (
        <EmptyState
          icon="cart"
          title="Your cart is empty"
          body="Add something you like and it'll show up here."
          action={
            onContinue && (
              <Button variant="default" onClick={onContinue}>
                Continue shopping
              </Button>
            )
          }
        />
      ) : (
        <div>
          {showMeter && (
            <div
              role="status"
              aria-live="polite"
              style={{
                marginBottom: "var(--space-4)",
                padding: "var(--space-3) var(--space-4)",
                borderRadius: "var(--radius-md)",
                background: unlocked ? "var(--lime-100)" : "var(--surface-sunken)",
                border: `1px solid ${unlocked ? "var(--lime-200)" : "var(--border)"}`,
              }}
            >
              <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--text-strong)" }}>
                {unlocked ? (
                  <>You&rsquo;ve unlocked <strong>free shipping</strong> 🎉</>
                ) : (
                  <>
                    You&rsquo;re <strong>{money(remaining, currency)}</strong> away from free
                    shipping
                  </>
                )}
              </p>
              <div
                aria-hidden
                style={{
                  marginTop: "var(--space-2)",
                  height: 6,
                  borderRadius: 999,
                  background: "var(--border)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${pct}%`,
                    borderRadius: 999,
                    background: "var(--lime-400)",
                    transition: "width var(--dur-slow, 400ms) var(--ease-out)",
                  }}
                />
              </div>
            </div>
          )}
          {items.map((item) => (
            <div className="cart-row" key={item.id}>
              <Thumb src={item.image} ratio="4 / 5" size={56} radius="var(--radius-md)" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "var(--space-2)",
                  }}
                >
                  <span
                    style={{
                      fontSize: "var(--text-sm)",
                      fontWeight: 500,
                      color: "var(--text-strong)",
                    }}
                  >
                    {item.title}
                  </span>
                  <span className="mono" style={{ fontSize: "var(--text-sm)" }}>
                    {money(item.price * item.quantity, currency)}
                  </span>
                </div>
                {item.variant && (
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                    {item.variant}
                  </span>
                )}
                <div
                  style={{
                    marginTop: "var(--space-2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Stepper
                    value={item.quantity}
                    min={1}
                    onChange={(q) => onQuantityChange?.(item.id, q)}
                    aria-label={`Quantity for ${item.title}`}
                  />
                  <IconButton
                    name="trash"
                    size={28}
                    aria-label={`Remove ${item.title}`}
                    onClick={() => onRemove?.(item.id)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}
