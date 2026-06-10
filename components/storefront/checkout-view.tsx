"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/states";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/format";
import { submitOrder } from "@/app/(store)/actions";
import { useStorefront, useStoreHref } from "./storefront-context";
import { STORE_HOME } from "./shared";
import { stashOrder } from "./order-handoff";

/**
 * Checkout (DESIGN §5.4) — two columns: contact + shipping form on the left, a sticky
 * order summary on the right. **Payment is a placeholder only — no real card fields**
 * (out-of-scope guardrail, DESIGN §8). "Place order" runs the Stage 10 `submitOrder`
 * action, which creates the real `pending` order + customer, decrements inventory, and
 * stamps `ageVerifiedAt` server-side; the returned order number is echoed on the
 * confirmation page. Prices are re-derived server-side from the catalog (never trusted
 * from the client).
 */
export function CheckoutView() {
  const sf = useStorefront();
  const router = useRouter();
  const href = useStoreHref();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: "",
    firstName: "",
    lastName: "",
    address: "",
    city: "",
    state: "OR",
    zip: "",
    phone: "",
  });

  if (!sf) return null;
  const { cart, subtotal, currency } = sf;
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  if (cart.length === 0) {
    return (
      <div className="store-container" style={{ paddingTop: "var(--space-16)", paddingBottom: "var(--space-16)" }}>
        <EmptyState
          icon="cart"
          title="Your cart is empty"
          body="Add something before checking out."
          action={
            <Link href={href(STORE_HOME)}>
              <Button variant="default">Continue shopping</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const placeOrder = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const items = cart.map((l) => ({
      title: l.title,
      variant: l.variant,
      quantity: l.quantity,
      price: l.price,
    }));
    startTransition(async () => {
      const res = await submitOrder({
        email: form.email,
        firstName: form.firstName,
        lastName: form.lastName,
        address: form.address,
        city: form.city,
        state: form.state,
        zip: form.zip,
        phone: form.phone,
        sessionId: sf.sessionId,
        lines: cart.map((l) => ({
          productId: l.productId,
          variantId: l.variantId,
          quantity: l.quantity,
        })),
      });
      if (!res.ok) {
        setError(res.error ?? "We couldn't place your order. Please try again.");
        return;
      }
      // Echo the real, server-allocated order number on the confirmation page.
      stashOrder({
        orderNumber: res.orderNumber ?? 0,
        email: form.email,
        total: res.total ?? subtotal,
        currency,
        items,
      });
      sf.clearCart();
      router.push(href("/order-confirmation"));
    });
  };

  return (
    <div
      className="store-container"
      style={{ maxWidth: 1000, paddingTop: "var(--space-10)", paddingBottom: "var(--space-12)" }}
    >
      <Link
        href={href(STORE_HOME)}
        className="btn btn-sm btn-ghost"
        style={{ marginBottom: 20, paddingLeft: 4, color: "var(--warm-600)" }}
      >
        <Icon name="chevronLeft" size={16} aria-hidden />
        <span>Back</span>
      </Link>

      <form className="store-split store-split-checkout" onSubmit={placeOrder}>
        {/* Contact + shipping */}
        <div>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              fontSize: "var(--text-2xl)",
              color: "var(--warm-900)",
              marginBottom: 24,
            }}
          >
            Checkout
          </h1>

          <Field label="Email">
            <Input
              type="email"
              large
              required
              placeholder="you@email.com"
              autoComplete="email"
              value={form.email}
              onChange={set("email")}
            />
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 16 }}>
            <Field label="First name">
              <Input large required autoComplete="given-name" value={form.firstName} onChange={set("firstName")} />
            </Field>
            <Field label="Last name">
              <Input large required autoComplete="family-name" value={form.lastName} onChange={set("lastName")} />
            </Field>
          </div>

          <div style={{ marginTop: 16 }}>
            <Field label="Address">
              <Input
                large
                required
                placeholder="Street address"
                autoComplete="street-address"
                value={form.address}
                onChange={set("address")}
              />
            </Field>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 14, marginTop: 16 }}>
            <Field label="City">
              <Input large required autoComplete="address-level2" value={form.city} onChange={set("city")} />
            </Field>
            <Field label="State">
              <Input large required autoComplete="address-level1" value={form.state} onChange={set("state")} />
            </Field>
            <Field label="ZIP">
              <Input large required mono autoComplete="postal-code" value={form.zip} onChange={set("zip")} />
            </Field>
          </div>

          <div style={{ marginTop: 16 }}>
            <Field label="Phone">
              <Input
                large
                mono
                placeholder="(503) 555-0000"
                autoComplete="tel"
                value={form.phone}
                onChange={set("phone")}
              />
            </Field>
          </div>

          {/* Payment placeholder — no real card fields (DESIGN §8). */}
          <div
            style={{
              marginTop: 20,
              padding: "var(--space-4)",
              background: "var(--info-bg)",
              borderRadius: "var(--radius-md)",
              fontSize: "var(--text-sm)",
              color: "var(--warm-700)",
              display: "flex",
              gap: 10,
            }}
          >
            <Icon name="info" size={16} style={{ color: "var(--info)", flexShrink: 0, marginTop: 1 }} aria-hidden />
            <span>
              Payment is arranged securely after we confirm your order — you won&rsquo;t be charged online. No card
              details are collected here.
            </span>
          </div>
        </div>

        {/* Order summary */}
        <div className="card" style={{ padding: "var(--space-6)", position: "sticky", top: 90 }}>
          <div style={{ fontWeight: 600, fontSize: "var(--text-md)", color: "var(--warm-900)", marginBottom: 16 }}>
            Order summary
          </div>
          {cart.map((l) => (
            <div
              key={l.key}
              style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 12, fontSize: "var(--text-base)" }}
            >
              <span style={{ color: "var(--text)" }}>
                {l.title}
                {l.variant ? ` · ${l.variant}` : ""} × {l.quantity}
              </span>
              <span className="mono" style={{ color: "var(--text-strong)", whiteSpace: "nowrap" }}>
                {money(l.price * l.quantity, currency)}
              </span>
            </div>
          ))}
          <hr className="divider" style={{ margin: "14px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
            <span style={{ fontWeight: 600, color: "var(--warm-900)" }}>Total</span>
            <span className="mono" style={{ fontWeight: 600, fontSize: "var(--text-md)", color: "var(--warm-900)" }}>
              {money(subtotal, currency)}
            </span>
          </div>
          <Button type="submit" variant="primary" size="lg" pill block loading={isPending}>
            {isPending ? "Placing order…" : "Place order"}
          </Button>
          {error && (
            <p
              role="alert"
              style={{
                marginTop: 12,
                fontSize: "var(--text-sm)",
                color: "var(--critical)",
                textAlign: "center",
              }}
            >
              {error}
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
