"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type {
  Address,
  FulfillmentStatus,
  PaymentStatus,
  PublicCustomer,
} from "@/types";
import { Icon } from "@/components/ui/icon";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { money, fmtDate } from "@/lib/format";
import { useStorefront, useStoreHref } from "./storefront-context";
import { lineKey, STORE_HOME } from "./shared";
import {
  loginAccount,
  registerAccount,
  logoutAccount,
  saveAddress,
  deleteAddress,
  requestLoginCode,
  verifyLoginCodeAction,
  type AccountCartLine,
} from "@/app/(store)/account/actions";

/** Order summary for the account history list (built server-side, no PII beyond own). */
export interface AccountOrderSummary {
  id: string;
  orderNumber: number;
  createdAt: string;
  total: number;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  itemCount: number;
}

const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  pending: "Payment pending",
  paid: "Paid",
  refunded: "Refunded",
};
const FULFILLMENT_LABEL: Record<FulfillmentStatus, string> = {
  unfulfilled: "Not shipped",
  partially_fulfilled: "Partially shipped",
  fulfilled: "Shipped",
  cancelled: "Cancelled",
};

const sectionTitle = {
  fontFamily: "var(--font-display)",
  fontWeight: 600,
  fontSize: "var(--text-xl)",
  color: "var(--warm-900)",
} as const;

const card = {
  padding: "var(--space-6)",
  background: "var(--warm-0)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-lg)",
} as const;

/**
 * Storefront account (Phase 3). Anonymous → login/register tabs; signed-in → a
 * dashboard with order history + a saved-address book. On auth success it adopts the
 * server-merged cart into the storefront context, then refreshes so the layout picks
 * up the new customer session (which re-keys the cart to the account).
 */
export function AccountView({
  customer,
  orders,
  currency,
}: {
  customer: PublicCustomer | null;
  orders: AccountOrderSummary[];
  currency: string;
}) {
  if (!customer) return <AuthPanel />;
  return <Dashboard customer={customer} orders={orders} currency={currency} />;
}

/* --------------------------------------------------------------- auth ---- */

function AuthPanel() {
  const sf = useStorefront();
  const router = useRouter();
  // "code" = passwordless (Shopify's default); "password" = classic email+password.
  const [mode, setMode] = useState<"code" | "password">("code");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // The anonymous cart to merge into the account on sign-in.
  const cartItems = (sf?.cart ?? []).map((l) => ({
    productId: l.productId,
    variantId: l.variantId,
    quantity: l.quantity,
    priceSnapshot: l.price,
  }));

  function adopt(lines: AccountCartLine[]) {
    sf?.setCartLines(
      lines.map((l) => ({
        key: lineKey(l.productId, l.variantId),
        productId: l.productId,
        variantId: l.variantId,
        handle: l.handle,
        title: l.title,
        ...(l.variant ? { variant: l.variant } : {}),
        price: l.price,
        quantity: l.quantity,
        image: l.image ?? null,
      })),
    );
  }

  function onSignedIn(cart?: AccountCartLine[]) {
    if (cart) adopt(cart);
    router.refresh();
  }

  return (
    <div
      className="store-container"
      style={{ maxWidth: 440, paddingTop: "var(--space-16)", paddingBottom: "var(--space-16)" }}
    >
      <h1 style={{ ...sectionTitle, fontSize: "var(--text-2xl)", marginBottom: 6 }}>Sign in</h1>
      <p style={{ color: "var(--warm-600)", fontSize: "var(--text-base)", marginBottom: 24 }}>
        Access your orders and saved addresses.
      </p>

      {mode === "code" ? (
        <CodeAuth
          cartItems={cartItems}
          error={error}
          setError={setError}
          pending={pending}
          startTransition={startTransition}
          onSignedIn={onSignedIn}
          onUsePassword={() => {
            setMode("password");
            setError(null);
          }}
        />
      ) : (
        <PasswordAuth
          cartItems={cartItems}
          error={error}
          setError={setError}
          pending={pending}
          startTransition={startTransition}
          onSignedIn={onSignedIn}
          onUseCode={() => {
            setMode("code");
            setError(null);
          }}
        />
      )}
    </div>
  );
}

type AuthCartItem = { productId: string; variantId: string; quantity: number; priceSnapshot: number };
interface AuthSubProps {
  cartItems: AuthCartItem[];
  error: string | null;
  setError: (e: string | null) => void;
  pending: boolean;
  startTransition: (cb: () => void) => void;
  onSignedIn: (cart?: AccountCartLine[]) => void;
}

/** Passwordless: email → 6-digit code. Also the "forgot password" recovery path. */
function CodeAuth({
  cartItems,
  error,
  setError,
  pending,
  startTransition,
  onSignedIn,
  onUsePassword,
}: AuthSubProps & { onUsePassword: () => void }) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [resent, setResent] = useState(false);

  function requestCode(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await requestLoginCode(email);
      if (!res.ok) {
        setError(res.error ?? "Couldn't send a code. Please try again.");
        return;
      }
      setStep("code");
    });
  }

  function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await verifyLoginCodeAction({ email, code, cart: cartItems });
      if (!res.ok) {
        setError(res.error ?? "That code isn't right.");
        return;
      }
      onSignedIn(res.cart);
    });
  }

  if (step === "email") {
    return (
      <form onSubmit={requestCode} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Field label="Email" help="We'll email you a 6-digit sign-in code — no password needed.">
          <Input
            type="email"
            large
            required
            autoComplete="email"
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Button type="submit" variant="primary" size="lg" pill block loading={pending}>
          Email me a code
        </Button>
        {error && <AuthError message={error} />}
        <button type="button" onClick={onUsePassword} style={authLinkStyle}>
          Use a password instead
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={verify} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--warm-700)", margin: 0 }}>
        We sent a 6-digit code to <strong>{email}</strong>. Enter it below.
      </p>
      <Field label="Sign-in code">
        <Input
          large
          required
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="123456"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          style={{ letterSpacing: "0.3em", fontVariantNumeric: "tabular-nums" }}
        />
      </Field>
      <Button type="submit" variant="primary" size="lg" pill block loading={pending}>
        Sign in
      </Button>
      {error && <AuthError message={error} />}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <button
          type="button"
          onClick={() => {
            setStep("email");
            setCode("");
            setError(null);
          }}
          style={authLinkStyle}
        >
          Use a different email
        </button>
        <button
          type="button"
          onClick={() => {
            setResent(true);
            requestCode();
          }}
          disabled={pending}
          style={authLinkStyle}
        >
          {resent ? "Code re-sent" : "Resend code"}
        </button>
      </div>
    </form>
  );
}

/** Classic email + password (sign in / register), kept as a secondary option. */
function PasswordAuth({
  cartItems,
  error,
  setError,
  pending,
  startTransition,
  onSignedIn,
  onUseCode,
}: AuthSubProps & { onUseCode: () => void }) {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res =
        tab === "login"
          ? await loginAccount({ email: form.email, password: form.password, cart: cartItems })
          : await registerAccount({ name: form.name, email: form.email, password: form.password, cart: cartItems });
      if (!res.ok) {
        setError(res.error ?? "Something went wrong. Please try again.");
        return;
      }
      onSignedIn(res.cart);
    });
  }

  return (
    <>
      <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
        {(["login", "register"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTab(t);
              setError(null);
            }}
            style={{
              flex: 1,
              padding: "8px 0",
              borderRadius: "var(--radius-md)",
              border: `1px solid ${tab === t ? "var(--accent)" : "var(--border)"}`,
              background: tab === t ? "var(--info-bg)" : "transparent",
              color: "var(--text-strong)",
              fontWeight: 500,
              fontSize: "var(--text-sm)",
              cursor: "pointer",
            }}
          >
            {t === "login" ? "Sign in" : "Register"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {tab === "register" && (
          <Field label="Name">
            <Input large required autoComplete="name" value={form.name} onChange={set("name")} />
          </Field>
        )}
        <Field label="Email">
          <Input type="email" large required autoComplete="email" value={form.email} onChange={set("email")} />
        </Field>
        <Field label="Password" help={tab === "register" ? "At least 8 characters." : undefined}>
          <Input
            type="password"
            large
            required
            autoComplete={tab === "login" ? "current-password" : "new-password"}
            value={form.password}
            onChange={set("password")}
          />
        </Field>
        <Button type="submit" variant="primary" size="lg" pill block loading={pending}>
          {tab === "login" ? "Sign in" : "Create account"}
        </Button>
        {error && <AuthError message={error} />}
        <button type="button" onClick={onUseCode} style={authLinkStyle}>
          {tab === "login" ? "Forgot your password? Email me a code instead" : "Sign in with an email code instead"}
        </button>
      </form>
    </>
  );
}

const authLinkStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  font: "inherit",
  fontSize: "var(--text-sm)",
  color: "var(--warm-700)",
  textDecoration: "underline",
  cursor: "pointer",
  textAlign: "center",
};

function AuthError({ message }: { message: string }) {
  return (
    <p role="alert" style={{ fontSize: "var(--text-sm)", color: "var(--critical)", textAlign: "center" }}>
      {message}
    </p>
  );
}

/* ---------------------------------------------------------- dashboard ---- */

function Dashboard({
  customer,
  orders,
  currency,
}: {
  customer: PublicCustomer;
  orders: AccountOrderSummary[];
  currency: string;
}) {
  const router = useRouter();
  const href = useStoreHref();
  const [pending, startTransition] = useTransition();

  function signOut() {
    startTransition(async () => {
      await logoutAccount();
      router.refresh();
    });
  }

  return (
    <div
      className="store-container"
      style={{ maxWidth: 760, paddingTop: "var(--space-12)", paddingBottom: "var(--space-16)" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 32,
        }}
      >
        <div>
          <h1 style={{ ...sectionTitle, fontSize: "var(--text-2xl)" }}>Hi, {customer.name}</h1>
          <p style={{ color: "var(--warm-600)", fontSize: "var(--text-base)", marginTop: 4 }}>
            {customer.email}
          </p>
        </div>
        <Button variant="default" onClick={signOut} loading={pending}>
          Sign out
        </Button>
      </div>

      {/* Order history */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ ...sectionTitle, marginBottom: 14 }}>Order history</h2>
        {orders.length === 0 ? (
          <EmptyState
            icon="orders"
            title="No orders yet"
            body="When you place an order it'll show up here."
            action={
              <Link href={href(STORE_HOME)}>
                <Button variant="default">Start shopping</Button>
              </Link>
            }
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {orders.map((o) => (
              <div
                key={o.id}
                style={{
                  ...card,
                  padding: "var(--space-4) var(--space-5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, color: "var(--warm-900)" }}>
                    Order <span className="mono">#{o.orderNumber}</span>
                  </div>
                  <div style={{ fontSize: "var(--text-sm)", color: "var(--warm-600)", marginTop: 2 }}>
                    {fmtDate(o.createdAt)} · {o.itemCount} item{o.itemCount === 1 ? "" : "s"}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <StatusChip label={PAYMENT_LABEL[o.paymentStatus]} />
                    <StatusChip label={FULFILLMENT_LABEL[o.fulfillmentStatus]} />
                  </div>
                </div>
                <span className="mono" style={{ fontWeight: 600, color: "var(--warm-900)", whiteSpace: "nowrap" }}>
                  {money(o.total, currency)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Saved addresses */}
      <AddressBook addresses={customer.addresses} defaultEmail={customer.email} />
    </div>
  );
}

function StatusChip({ label }: { label: string }) {
  return (
    <span
      style={{
        fontSize: "var(--text-xs)",
        color: "var(--warm-700)",
        background: "var(--surface-subtle)",
        border: "1px solid var(--border)",
        borderRadius: 999,
        padding: "2px 10px",
      }}
    >
      {label}
    </span>
  );
}

/* ----------------------------------------------------- address book ---- */

function AddressBook({
  addresses,
  defaultEmail,
}: {
  addresses: Address[];
  defaultEmail: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", address: "" });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await saveAddress({
        name: form.name.trim(),
        email: defaultEmail,
        ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
        address: form.address.trim(),
      });
      if (!res.ok) {
        setError(res.error ?? "Couldn't save the address.");
        return;
      }
      setForm({ name: "", phone: "", address: "" });
      setAdding(false);
      router.refresh();
    });
  }

  function remove(index: number) {
    startTransition(async () => {
      await deleteAddress(index);
      router.refresh();
    });
  }

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <h2 style={sectionTitle}>Saved addresses</h2>
        {!adding && (
          <Button variant="default" icon="plus" onClick={() => setAdding(true)}>
            Add address
          </Button>
        )}
      </div>

      {addresses.length === 0 && !adding && (
        <p style={{ color: "var(--warm-600)", fontSize: "var(--text-base)" }}>
          No saved addresses yet.
        </p>
      )}

      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
        {addresses.map((a, i) => (
          <div key={i} style={{ ...card, position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Icon name="mapPin" size={15} style={{ color: "var(--warm-500)" }} aria-hidden />
              <span style={{ fontWeight: 600, color: "var(--warm-900)" }}>{a.name}</span>
            </div>
            <div style={{ fontSize: "var(--text-sm)", color: "var(--text)", lineHeight: 1.5 }}>{a.address}</div>
            {a.phone && (
              <div className="mono" style={{ fontSize: "var(--text-xs)", color: "var(--warm-600)", marginTop: 6 }}>
                {a.phone}
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              icon="trash"
              aria-label="Remove address"
              disabled={pending}
              onClick={() => remove(i)}
              style={{ position: "absolute", top: 10, right: 10 }}
            />
          </div>
        ))}
      </div>

      {adding && (
        <form onSubmit={add} style={{ ...card, marginTop: 12, display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Full name">
            <Input required value={form.name} onChange={set("name")} autoComplete="name" />
          </Field>
          <Field label="Address">
            <Input
              required
              placeholder="Street, city, state, ZIP"
              value={form.address}
              onChange={set("address")}
              autoComplete="street-address"
            />
          </Field>
          <Field label="Phone">
            <Input mono value={form.phone} onChange={set("phone")} autoComplete="tel" />
          </Field>
          {error && (
            <p role="alert" style={{ fontSize: "var(--text-sm)", color: "var(--critical)" }}>
              {error}
            </p>
          )}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={pending}>
              Save address
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
