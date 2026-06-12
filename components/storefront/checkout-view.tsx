"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { SettlementMethod } from "@/types";
import { Icon } from "@/components/ui/icon";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/states";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/format";
import { applyDiscount, submitOrder } from "@/app/(store)/actions";
import { useStorefront, useStoreHref } from "./storefront-context";
import { STORE_HOME } from "./shared";
import { stashOrder } from "./order-handoff";

/** Which settlement methods the store offers — derived server-side from settings. */
type SettlementFlags = Record<SettlementMethod, boolean>;

/** Customer-facing label + helper note per settlement method. */
const SETTLEMENT_META: Record<
  SettlementMethod,
  { label: string; note?: string }
> = {
  online: { label: "Pay online" },
  cod: { label: "Cash on delivery", note: "You'll pay when your order arrives." },
  in_store: { label: "Pay in store", note: "You'll pay at pickup." },
};

/**
 * Enabled methods in display order. When `online` is offered it leads (it's the
 * default for most stores); when it isn't, the offline methods (cod, then in-store)
 * become the leading default — so `methods[0]` is always a sensible default select.
 */
function orderedMethods(flags: SettlementFlags): SettlementMethod[] {
  const order: SettlementMethod[] = flags.online
    ? ["online", "cod", "in_store"]
    : ["cod", "in_store"];
  return order.filter((m) => flags[m]);
}

/** Map a server rejection reason to friendly inline copy. */
function discountError(reason?: string): string {
  switch (reason) {
    case "below_min":
      return "Minimum order not met for this code.";
    case "expired":
      return "This code has expired.";
    case "not_started":
      return "This code isn't active yet.";
    case "used_up":
      return "This code has reached its usage limit.";
    case "disabled":
      return "This code is no longer available.";
    default:
      return "Invalid code.";
  }
}

/**
 * Checkout (DESIGN §5.4) — two columns: contact + shipping form on the left, a sticky
 * order summary on the right. **Payment is a placeholder only — no real card fields**
 * (out-of-scope guardrail, DESIGN §8). "Place order" runs the Stage 10 `submitOrder`
 * action, which creates the real `pending` order + customer, decrements inventory, and
 * stamps `ageVerifiedAt` server-side; the returned order number is echoed on the
 * confirmation page. Prices are re-derived server-side from the catalog (never trusted
 * from the client).
 */
export function CheckoutView({ settlements }: { settlements: SettlementFlags }) {
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

  // Enabled settlement methods, in display order; default to the first.
  const methods = useMemo(() => orderedMethods(settlements), [settlements]);
  const [settlement, setSettlement] = useState<SettlementMethod>(
    () => methods[0] ?? "online",
  );

  // Promo code state. `applied` is the server-validated preview; the authoritative
  // discount is re-computed in `placeOrder`, so this only affects what's DISPLAYED.
  const [codeInput, setCodeInput] = useState("");
  const [applied, setApplied] = useState<{ code: string; amount: number } | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [applying, startApplying] = useTransition();

  if (!sf) return null;
  const { cart, subtotal, currency } = sf;
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  // If the cart changed under an applied code, the stale amount can exceed subtotal;
  // clamp the display so the total never goes negative (server re-validates anyway).
  const discountAmount = applied ? Math.min(applied.amount, subtotal) : 0;
  const total = Math.max(0, subtotal - discountAmount);

  const onApplyCode = () => {
    const code = codeInput.trim();
    if (!code) return;
    setCodeError(null);
    startApplying(async () => {
      const res = await applyDiscount(code, subtotal);
      if (res.ok && res.code && typeof res.amount === "number") {
        setApplied({ code: res.code, amount: res.amount });
        setCodeInput(res.code);
      } else {
        setApplied(null);
        setCodeError(discountError(res.reason));
      }
    });
  };

  const removeCode = () => {
    setApplied(null);
    setCodeInput("");
    setCodeError(null);
  };

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
        ...(applied ? { discountCode: applied.code } : {}),
        settlementMethod: settlement,
      });
      if (!res.ok) {
        setError(res.error ?? "We couldn't place your order. Please try again.");
        return;
      }
      // Echo the real, server-allocated order number on the confirmation page.
      stashOrder({
        orderNumber: res.orderNumber ?? 0,
        email: form.email,
        total: res.total ?? total,
        currency,
        items,
        ...(applied ? { discount: { code: applied.code, amount: discountAmount } } : {}),
        settlementMethod: settlement,
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

          {/* Settlement method (PRD §6.6) — only the methods the store enables. */}
          {methods.length > 0 && (
            <SettlementSelector
              methods={methods}
              selected={settlement}
              onSelect={setSettlement}
            />
          )}

          {/* Payment placeholder — no real card fields (DESIGN §8). */}
          {settlement === "online" && (
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
          )}
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

          {/* Promo code (PRD §6.6) — server-validated preview; total re-checked on order. */}
          <PromoCode
            value={codeInput}
            onChange={setCodeInput}
            applied={applied}
            applying={applying}
            error={codeError}
            currency={currency}
            discountAmount={discountAmount}
            onApply={onApplyCode}
            onRemove={removeCode}
          />

          {applied && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 8,
                fontSize: "var(--text-base)",
                color: "var(--accent-pressed)",
              }}
            >
              <span>Discount · {applied.code}</span>
              <span className="mono" style={{ whiteSpace: "nowrap" }}>
                −{money(discountAmount, currency)}
              </span>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
            <span style={{ fontWeight: 600, color: "var(--warm-900)" }}>Total</span>
            <span className="mono" style={{ fontWeight: 600, fontSize: "var(--text-md)", color: "var(--warm-900)" }}>
              {money(total, currency)}
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

/**
 * Settlement method picker. A single enabled method renders as a static line (no
 * choice to make); two or more render as an accessible radio group with a helper
 * note for the offline methods. Labels come from `SETTLEMENT_META`.
 */
function SettlementSelector({
  methods,
  selected,
  onSelect,
}: {
  methods: SettlementMethod[];
  selected: SettlementMethod;
  onSelect: (m: SettlementMethod) => void;
}) {
  const only = methods.length === 1 ? methods[0] : undefined;
  if (only) {
    return (
      <div style={{ marginTop: 24 }}>
        <div
          style={{
            fontSize: "var(--text-sm)",
            fontWeight: 600,
            color: "var(--warm-900)",
            marginBottom: 10,
          }}
        >
          Payment method
        </div>
        <div
          style={{
            padding: "var(--space-3) var(--space-4)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            fontSize: "var(--text-base)",
            color: "var(--text-strong)",
          }}
        >
          {SETTLEMENT_META[only].label}
          {SETTLEMENT_META[only].note && (
            <div style={{ marginTop: 4, fontSize: "var(--text-sm)", color: "var(--warm-600)" }}>
              {SETTLEMENT_META[only].note}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <fieldset style={{ marginTop: 24, border: 0, padding: 0 }}>
      <legend
        style={{
          fontSize: "var(--text-sm)",
          fontWeight: 600,
          color: "var(--warm-900)",
          marginBottom: 10,
          padding: 0,
        }}
      >
        Payment method
      </legend>
      <div style={{ display: "grid", gap: 8 }}>
        {methods.map((m) => {
          const checked = selected === m;
          return (
            <label
              key={m}
              style={{
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
                padding: "var(--space-3) var(--space-4)",
                border: `1px solid ${checked ? "var(--accent)" : "var(--border)"}`,
                borderRadius: "var(--radius-md)",
                cursor: "pointer",
                background: checked ? "var(--info-bg)" : "transparent",
              }}
            >
              <input
                type="radio"
                name="settlement"
                value={m}
                checked={checked}
                onChange={() => onSelect(m)}
                style={{ marginTop: 3, accentColor: "var(--accent-pressed)" }}
              />
              <span>
                <span style={{ fontSize: "var(--text-base)", color: "var(--text-strong)", fontWeight: 500 }}>
                  {SETTLEMENT_META[m].label}
                </span>
                {SETTLEMENT_META[m].note && (
                  <span style={{ display: "block", marginTop: 2, fontSize: "var(--text-sm)", color: "var(--warm-600)" }}>
                    {SETTLEMENT_META[m].note}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * Promo-code input shown in the order summary. Once a code is applied it collapses
 * to a removable chip; otherwise it shows an input + "Apply". The Apply button is
 * `type="button"` so it never submits the surrounding checkout form, and Enter in
 * the field applies the code rather than placing the order.
 */
function PromoCode({
  value,
  onChange,
  applied,
  applying,
  error,
  currency,
  discountAmount,
  onApply,
  onRemove,
}: {
  value: string;
  onChange: (v: string) => void;
  applied: { code: string; amount: number } | null;
  applying: boolean;
  error: string | null;
  currency: string;
  discountAmount: number;
  onApply: () => void;
  onRemove: () => void;
}) {
  if (applied) {
    return (
      <div style={{ marginBottom: 14 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            padding: "8px 12px",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            background: "var(--info-bg)",
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: "var(--text-base)" }}>
            <Icon name="check" size={15} style={{ color: "var(--accent-pressed)" }} aria-hidden />
            <span className="mono" style={{ color: "var(--warm-900)", fontWeight: 500 }}>
              {applied.code}
            </span>
            <span style={{ color: "var(--warm-600)" }}>−{money(discountAmount, currency)}</span>
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
            Remove
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 14 }}>
      <Field label="Promo code" error={error ?? undefined}>
        {(p) => (
          <div style={{ display: "flex", gap: 8 }}>
            <Input
              {...p}
              mono
              placeholder="Enter code"
              autoCapitalize="characters"
              spellCheck={false}
              value={value}
              error={!!error}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onApply();
                }
              }}
            />
            <Button
              type="button"
              variant="default"
              onClick={onApply}
              loading={applying}
              disabled={!value.trim() || applying}
            >
              Apply
            </Button>
          </div>
        )}
      </Field>
    </div>
  );
}
