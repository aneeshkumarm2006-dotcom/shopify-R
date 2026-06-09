"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Stepper } from "@/components/ui/stepper";
import { IconButton } from "@/components/ui/icon-button";
import { Media } from "@/components/sections/media";
import { EmptyState } from "@/components/ui/states";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/format";
import { useStorefront } from "./storefront-context";
import { STORE_HOME } from "./shared";

/**
 * Full cart page (DESIGN §5.4) — the routed companion to the quick cart sheet, sharing
 * the same context cart. Line items with image, title, variant, qty stepper and line
 * price; mono subtotal; Checkout CTA. No discount field (out of scope). Designed empty
 * state when there's nothing in the cart.
 */
export function CartPage() {
  const sf = useStorefront();
  const router = useRouter();
  if (!sf) return null;
  const { cart, subtotal, currency } = sf;

  return (
    <div className="store-container" style={{ paddingTop: "var(--space-12)", paddingBottom: "var(--space-16)" }}>
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 600,
          fontSize: "var(--text-2xl)",
          color: "var(--warm-900)",
          marginBottom: "var(--space-8)",
        }}
      >
        Your cart
      </h1>

      {cart.length === 0 ? (
        <EmptyState
          icon="cart"
          title="Your cart is empty"
          body="Browse the shop and add something you like."
          action={
            <Link href={STORE_HOME}>
              <Button variant="default">Continue shopping</Button>
            </Link>
          }
        />
      ) : (
        <div className="store-split store-split-checkout">
          {/* Line items */}
          <div>
            {cart.map((l) => (
              <div
                key={l.key}
                style={{
                  display: "flex",
                  gap: 16,
                  padding: "var(--space-4) 0",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div style={{ width: 80, flexShrink: 0 }}>
                  <Media src={l.image} alt={l.title} ratio="4 / 5" radius="var(--radius-md)" iconSize={20} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <Link
                      href={`/products/${l.handle}`}
                      style={{ fontWeight: 500, fontSize: "var(--text-md)", color: "var(--text-strong)" }}
                    >
                      {l.title}
                    </Link>
                    <span className="mono" style={{ fontSize: "var(--text-md)", color: "var(--text-strong)" }}>
                      {money(l.price * l.quantity, currency)}
                    </span>
                  </div>
                  {l.variant && (
                    <div style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", marginTop: 2 }}>
                      {l.variant}
                    </div>
                  )}
                  <div
                    style={{
                      marginTop: 12,
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <Stepper
                      value={l.quantity}
                      min={1}
                      onChange={(q) => sf.setQuantity(l.key, q)}
                      aria-label={`Quantity for ${l.title}`}
                    />
                    <span className="mono" style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                      {money(l.price, currency)} each
                    </span>
                    <IconButton
                      name="trash"
                      size={28}
                      aria-label={`Remove ${l.title}`}
                      onClick={() => sf.removeLine(l.key)}
                      style={{ marginLeft: "auto" }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="card" style={{ padding: "var(--space-6)", position: "sticky", top: 90 }}>
            <div style={{ fontWeight: 600, fontSize: "var(--text-md)", color: "var(--warm-900)", marginBottom: 16 }}>
              Order summary
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: "var(--text-base)" }}>
              <span style={{ color: "var(--text)" }}>Subtotal</span>
              <span className="mono" style={{ color: "var(--text-strong)" }}>
                {money(subtotal, currency)}
              </span>
            </div>
            <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", margin: "0 0 16px" }}>
              Shipping calculated at checkout.
            </p>
            <Button variant="primary" size="lg" pill block onClick={() => router.push("/checkout")}>
              Checkout
            </Button>
            <Link
              href={STORE_HOME}
              style={{
                display: "block",
                textAlign: "center",
                marginTop: 12,
                fontSize: "var(--text-sm)",
                color: "var(--text-muted)",
              }}
            >
              Continue shopping
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
