"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { SettlementMethod, ShippingSettings, TaxSettings } from "@/types";
import { Icon } from "@/components/ui/icon";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/states";
import { Button } from "@/components/ui/button";
import { availableShippingRates, type ResolvedShippingRate } from "@/lib/data/shipping";
import { computeTax, taxLabel } from "@/lib/data/tax";
import { money } from "@/lib/format";
import { applyDiscount, previewGiftCard, submitOrder } from "@/app/(store)/actions";
import { useStorefront, useStoreHref } from "./storefront-context";
import { STORE_HOME } from "./shared";
import { stashOrder } from "./order-handoff";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** US state options for the address select (Shopify uses a region select, not free text). */
const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN",
  "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV",
  "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN",
  "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC",
];

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

function giftCardErrorCopy(reason?: string): string {
  switch (reason) {
    case "expired":
      return "This gift card has expired.";
    case "empty":
      return "This gift card has no balance left.";
    case "disabled":
      return "This gift card is no longer active.";
    default:
      return "We couldn't find that gift card.";
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
export function CheckoutView({
  settlements,
  shippingSettings,
  taxSettings,
}: {
  settlements: SettlementFlags;
  shippingSettings?: ShippingSettings;
  taxSettings?: TaxSettings;
}) {
  const sf = useStorefront();
  const router = useRouter();
  const href = useStoreHref();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});
  // Prefill contact from the signed-in shopper (Phase 3), if any.
  const [form, setForm] = useState(() => {
    const c = sf?.customer;
    const [firstName = "", ...rest] = (c?.name ?? "").trim().split(/\s+/);
    return {
      email: c?.email ?? "",
      firstName,
      lastName: rest.join(" "),
      address: "",
      city: "",
      state: "OR",
      zip: "",
      phone: "",
    };
  });

  // Enabled settlement methods, in display order; default to the first.
  const methods = useMemo(() => orderedMethods(settlements), [settlements]);
  const [settlement, setSettlement] = useState<SettlementMethod>(
    () => methods[0] ?? "online",
  );
  // Chosen shipping rate id ("" → fall back to the first available rate). The price is
  // always re-resolved SERVER-SIDE in `placeOrder`; this only drives what's displayed.
  const [shippingRateId, setShippingRateId] = useState<string>("");

  // Promo code state. `applied` is the server-validated preview; the authoritative
  // discount is re-computed in `placeOrder`, so this only affects what's DISPLAYED.
  const [codeInput, setCodeInput] = useState("");
  const [applied, setApplied] = useState<{ code: string; amount: number } | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [applying, startApplying] = useTransition();

  // Gift-card state (Phase 4). `giftApplied.applies` is the server-validated preview of
  // how much the card covers; the authoritative draw-down happens in `placeOrder`.
  const [giftInput, setGiftInput] = useState("");
  const [giftApplied, setGiftApplied] = useState<{ code: string; applies: number } | null>(null);
  const [giftError, setGiftError] = useState<string | null>(null);
  const [giftBusy, startGift] = useTransition();

  if (!sf) return null;
  const { cart, subtotal, currency } = sf;
  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm((f) => ({ ...f, [k]: e.target.value }));
      // Clear a field's error as soon as the shopper starts correcting it.
      if (fieldErrors[k]) setFieldErrors((fe) => ({ ...fe, [k]: undefined }));
    };

  /** Per-field validation; null = valid. Phone is optional. */
  function fieldError(k: string, raw: string): string | null {
    const v = raw.trim();
    switch (k) {
      case "email":
        return !v ? "Enter your email." : !EMAIL_RE.test(v) ? "Enter a valid email address." : null;
      case "firstName":
        return !v ? "Enter your first name." : null;
      case "lastName":
        return !v ? "Enter your last name." : null;
      case "address":
        return !v ? "Enter your street address." : null;
      case "city":
        return !v ? "Enter your city." : null;
      case "state":
        return !v ? "Select your state." : null;
      case "zip":
        return !v ? "Enter your ZIP code." : !/^\d{5}(-\d{4})?$/.test(v) ? "Enter a valid ZIP." : null;
      default:
        return null;
    }
  }
  const onBlurField = (k: keyof typeof form) => () =>
    setFieldErrors((fe) => ({ ...fe, [k]: fieldError(k, form[k]) ?? undefined }));

  // If the cart changed under an applied code, the stale amount can exceed subtotal;
  // clamp the display so the total never goes negative (server re-validates anyway).
  const discountAmount = applied ? Math.min(applied.amount, subtotal) : 0;
  const discountedSubtotal = Math.max(0, subtotal - discountAmount);

  // Shipping + tax PREVIEW (Phase 2). Recomputed from the same pure engines the server
  // uses, off the live region (state field) + discounted subtotal, so the summary
  // tracks the form. `placeOrder` re-resolves both authoritatively from store settings.
  const region = form.state.trim();
  const rates = availableShippingRates(shippingSettings, {
    subtotal: discountedSubtotal,
    region,
  });
  const selectedRate: ResolvedShippingRate =
    rates.find((r) => r.id === shippingRateId) ?? rates[0] ?? { id: "standard", label: "Standard", price: 0 };
  const shippingTotal = selectedRate.price;
  const taxTotal = computeTax(taxSettings, {
    subtotal: discountedSubtotal,
    shipping: shippingTotal,
    region,
  });
  const total = discountedSubtotal + shippingTotal + taxTotal;

  // Gift card applies against the amount due (after discount/shipping/tax); clamp to the
  // live total in case the cart changed since the code was applied (server re-draws anyway).
  const giftCardAmount = giftApplied ? Math.min(giftApplied.applies, total) : 0;
  const amountDue = Math.max(0, total - giftCardAmount);

  const onApplyGift = () => {
    const code = giftInput.trim();
    if (!code) return;
    setGiftError(null);
    startGift(async () => {
      const res = await previewGiftCard(code, total);
      if (res.ok && res.code && typeof res.applies === "number") {
        setGiftApplied({ code: res.code, applies: res.applies });
        setGiftInput(res.code);
      } else {
        setGiftApplied(null);
        setGiftError(giftCardErrorCopy(res.reason));
      }
    });
  };

  const removeGift = () => {
    setGiftApplied(null);
    setGiftInput("");
    setGiftError(null);
  };

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
    // Inline-validate every required field; block + focus the first invalid one.
    const REQUIRED = ["email", "firstName", "lastName", "address", "city", "state", "zip"] as const;
    const errs: Record<string, string> = {};
    for (const k of REQUIRED) {
      const msg = fieldError(k, form[k]);
      if (msg) errs[k] = msg;
    }
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      const first = REQUIRED.find((k) => errs[k]);
      if (first) {
        const el = document.querySelector<HTMLElement>(`[name="checkout-${first}"]`);
        el?.focus();
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }
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
        ...(giftApplied ? { giftCardCode: giftApplied.code } : {}),
        settlementMethod: settlement,
        shippingRateId: selectedRate.id,
      });
      if (!res.ok) {
        setError(res.error ?? "We couldn't place your order. Please try again.");
        return;
      }
      // Echo the real, server-allocated order number on the confirmation page.
      stashOrder({
        orderNumber: res.orderNumber ?? 0,
        email: form.email,
        subtotal,
        total: res.total ?? total,
        currency,
        items,
        ...(applied ? { discount: { code: applied.code, amount: discountAmount } } : {}),
        shipping: { method: selectedRate.label, amount: shippingTotal },
        ...(taxTotal > 0 ? { tax: { label: taxLabel(taxSettings), amount: taxTotal } } : {}),
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

          <Field label="Email" error={fieldErrors.email}>
            <Input
              name="checkout-email"
              type="email"
              large
              placeholder="you@email.com"
              autoComplete="email"
              value={form.email}
              onChange={set("email")}
              onBlur={onBlurField("email")}
              error={Boolean(fieldErrors.email)}
            />
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 16 }}>
            <Field label="First name" error={fieldErrors.firstName}>
              <Input name="checkout-firstName" large autoComplete="given-name" value={form.firstName} onChange={set("firstName")} onBlur={onBlurField("firstName")} error={Boolean(fieldErrors.firstName)} />
            </Field>
            <Field label="Last name" error={fieldErrors.lastName}>
              <Input name="checkout-lastName" large autoComplete="family-name" value={form.lastName} onChange={set("lastName")} onBlur={onBlurField("lastName")} error={Boolean(fieldErrors.lastName)} />
            </Field>
          </div>

          <div style={{ marginTop: 16 }}>
            <Field label="Address" error={fieldErrors.address}>
              <Input
                name="checkout-address"
                large
                placeholder="Street address"
                autoComplete="street-address"
                value={form.address}
                onChange={set("address")}
                onBlur={onBlurField("address")}
                error={Boolean(fieldErrors.address)}
              />
            </Field>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 14, marginTop: 16 }}>
            <Field label="City" error={fieldErrors.city}>
              <Input name="checkout-city" large autoComplete="address-level2" value={form.city} onChange={set("city")} onBlur={onBlurField("city")} error={Boolean(fieldErrors.city)} />
            </Field>
            <Field label="State" error={fieldErrors.state}>
              <Select
                name="checkout-state"
                large
                options={US_STATES}
                autoComplete="address-level1"
                value={form.state}
                onChange={set("state")}
                onBlur={onBlurField("state")}
                error={Boolean(fieldErrors.state)}
              />
            </Field>
            <Field label="ZIP" error={fieldErrors.zip}>
              <Input name="checkout-zip" large mono autoComplete="postal-code" value={form.zip} onChange={set("zip")} onBlur={onBlurField("zip")} error={Boolean(fieldErrors.zip)} />
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

          {/* Shipping method (Phase 2) — only shown to choose from when the store
              configures more than one rate; a single rate rides in the summary line. */}
          {rates.length > 1 && (
            <ShippingSelector
              rates={rates}
              selectedId={selectedRate.id}
              currency={currency}
              onSelect={setShippingRateId}
            />
          )}

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

          {/* Gift card (Phase 4) — server-validated preview; drawn down on order. */}
          <GiftCardCode
            value={giftInput}
            onChange={setGiftInput}
            applied={giftApplied}
            applying={giftBusy}
            error={giftError}
            currency={currency}
            amount={giftCardAmount}
            onApply={onApplyGift}
            onRemove={removeGift}
          />

          {/* Totals breakdown (Phase 2): subtotal → discount → shipping → tax → total. */}
          <SummaryLine label="Subtotal" value={money(subtotal, currency)} />
          {applied && (
            <SummaryLine
              label={`Discount · ${applied.code}`}
              value={`−${money(discountAmount, currency)}`}
              accent
            />
          )}
          <SummaryLine
            label={`Shipping${selectedRate.label ? ` · ${selectedRate.label}` : ""}`}
            value={shippingTotal > 0 ? money(shippingTotal, currency) : "Free"}
          />
          {taxTotal > 0 && (
            <SummaryLine label={taxLabel(taxSettings)} value={money(taxTotal, currency)} />
          )}
          {giftCardAmount > 0 && giftApplied && (
            <SummaryLine
              label={`Gift card · ${giftApplied.code}`}
              value={`−${money(giftCardAmount, currency)}`}
              accent
            />
          )}

          <div style={{ display: "flex", justifyContent: "space-between", margin: "12px 0 20px" }}>
            <span style={{ fontWeight: 600, color: "var(--warm-900)" }}>Total</span>
            <span className="mono" style={{ fontWeight: 600, fontSize: "var(--text-md)", color: "var(--warm-900)" }}>
              {money(amountDue, currency)}
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

/** One label/value row in the order-summary totals breakdown. */
function SummaryLine({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
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
 * Shipping-rate picker (Phase 2). Rendered only when the store offers more than one
 * rate; an accessible radio group mirroring the settlement selector, each row showing
 * the rate label and its price ("Free" when zeroed by a free-shipping threshold).
 */
function ShippingSelector({
  rates,
  selectedId,
  currency,
  onSelect,
}: {
  rates: ResolvedShippingRate[];
  selectedId: string;
  currency: string;
  onSelect: (id: string) => void;
}) {
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
        Shipping method
      </legend>
      <div style={{ display: "grid", gap: 8 }}>
        {rates.map((r) => {
          const checked = selectedId === r.id;
          return (
            <label
              key={r.id}
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                justifyContent: "space-between",
                padding: "var(--space-3) var(--space-4)",
                border: `1px solid ${checked ? "var(--accent)" : "var(--border)"}`,
                borderRadius: "var(--radius-md)",
                cursor: "pointer",
                background: checked ? "var(--info-bg)" : "transparent",
              }}
            >
              <span style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
                <input
                  type="radio"
                  name="shipping"
                  value={r.id}
                  checked={checked}
                  onChange={() => onSelect(r.id)}
                  style={{ accentColor: "var(--accent-pressed)" }}
                />
                <span style={{ fontSize: "var(--text-base)", color: "var(--text-strong)", fontWeight: 500 }}>
                  {r.label}
                </span>
              </span>
              <span className="mono" style={{ fontSize: "var(--text-sm)", color: "var(--text-strong)" }}>
                {r.price > 0 ? money(r.price, currency) : "Free"}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
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

/**
 * Gift-card input (Phase 4) — same collapse-to-chip pattern as `PromoCode`. The applied
 * chip shows the amount the card covers; the real draw-down happens in `placeOrder`.
 */
function GiftCardCode({
  value,
  onChange,
  applied,
  applying,
  error,
  currency,
  amount,
  onApply,
  onRemove,
}: {
  value: string;
  onChange: (v: string) => void;
  applied: { code: string; applies: number } | null;
  applying: boolean;
  error: string | null;
  currency: string;
  amount: number;
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
            <Icon name="tag" size={15} style={{ color: "var(--accent-pressed)" }} aria-hidden />
            <span className="mono" style={{ color: "var(--warm-900)", fontWeight: 500 }}>
              {applied.code}
            </span>
            <span style={{ color: "var(--warm-600)" }}>−{money(amount, currency)}</span>
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
      <Field label="Gift card" error={error ?? undefined}>
        {(p) => (
          <div style={{ display: "flex", gap: 8 }}>
            <Input
              {...p}
              mono
              placeholder="GIFT-XXXX-XXXX-XXXX"
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
