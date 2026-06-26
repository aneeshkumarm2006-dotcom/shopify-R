"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Store, Subscription, SubscriptionPlan } from "@/types";
import { saveStoreSettings, setPlanAction } from "@/app/(admin)/settings/actions";
import { unpublishStoreAction } from "@/app/(admin)/publish/actions";
import {
  Button,
  Card,
  Field,
  Icon,
  ImageDropzone,
  Input,
  Modal,
  PageHeader,
  Pill,
  Switch,
  Textarea,
  useToast,
} from "@/components/ui";
import { storeStatusPill } from "@/components/admin/shared";
import { storeDomain, CURRENCIES } from "@/lib/format";
import { getPlan, listPlans } from "@/lib/payments/billing";

/** Editable shipping-rate row (numbers/regions held as strings while typing). */
interface RateDraft {
  id: string;
  label: string;
  price: string;
  freeOver: string;
  regions: string;
}

function ratesToDrafts(rates: { id: string; label: string; price: number; freeOver?: number | null; regions?: string[] }[] = []): RateDraft[] {
  return rates.map((r) => ({
    id: r.id,
    label: r.label,
    price: String(r.price),
    freeOver: r.freeOver != null ? String(r.freeOver) : "",
    regions: (r.regions ?? []).join(", "),
  }));
}

/**
 * Settings (DESIGN §4.10) — store info · brand/logo · domain · SEO defaults · code
 * injection · age gate · plan/billing, plus a danger zone (unpublish/delete). Code
 * injection + custom-domain are UI-only signposts here; sanitization + persistence
 * land in Stage 11/14. Custom domains stay a disabled "Coming soon" row (PRD §10).
 */
export function Settings({
  store,
  subscription,
}: {
  store: Store;
  subscription: Subscription;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState(store.status);
  const mark = () => setDirty(true);

  // Billing plan (placeholder catalog — free/standard, Stage 12). Billing is stubbed
  // (no processor), so the plan is clickable here and switches instantly.
  const plans = listPlans();
  const [currentPlan, setCurrentPlan] = useState<SubscriptionPlan>(subscription.plan);
  const [planPending, startPlanTransition] = useTransition();

  function choosePlan(next: SubscriptionPlan) {
    if (next === currentPlan || planPending) return;
    startPlanTransition(async () => {
      const res = await setPlanAction(next);
      if (res.ok) {
        setCurrentPlan(next);
        toast(`Switched to ${getPlan(next).name} plan.`, { tone: "success" });
        router.refresh();
      } else {
        toast("Couldn't change plan.", { tone: "critical" });
      }
    });
  }

  // Store details
  const [name, setName] = useState(store.name);
  const [contactEmail, setContactEmail] = useState(store.settings.contactEmail);
  const [currency, setCurrency] = useState(store.settings.currency);
  // Multi-currency (Phase 2): an ISO code drives formatting; "" = legacy custom symbol.
  const [currencyCode, setCurrencyCode] = useState(store.settings.currencyCode ?? "");
  const [logo, setLogo] = useState<string[]>(
    store.settings.logoUrl ? [store.settings.logoUrl] : [],
  );

  // Tax engine (Phase 2). Disabled by default → zero tax at checkout.
  const tax = store.settings.tax;
  const [taxEnabled, setTaxEnabled] = useState(tax?.enabled ?? false);
  const [taxLabelV, setTaxLabelV] = useState(tax?.label ?? "Sales tax");
  const [taxRate, setTaxRate] = useState(String(tax?.rate ?? 0));
  const [taxOnShipping, setTaxOnShipping] = useState(tax?.appliesToShipping ?? false);

  // Shipping engine (Phase 2). Disabled/empty → free "Standard" at checkout.
  const [shipEnabled, setShipEnabled] = useState(store.settings.shipping?.enabled ?? false);
  const [rateDrafts, setRateDrafts] = useState<RateDraft[]>(
    ratesToDrafts(store.settings.shipping?.rates),
  );

  // SEO defaults
  const [seoTitle, setSeoTitle] = useState(store.seoDefaults.title);
  const [seoDesc, setSeoDesc] = useState(store.seoDefaults.description);

  // Code injection
  const [code, setCode] = useState(store.codeInjection);

  // Checkout & payment methods — defaults when `settlement` is absent: online on,
  // cod/in-store off (mirrors the data layer's `enabledSettlements` fallback).
  const settlement = store.settings.settlement;
  const [payOnline, setPayOnline] = useState(settlement?.online ?? true);
  const [payCod, setPayCod] = useState(settlement?.cod ?? false);
  const [payInStore, setPayInStore] = useState(settlement?.inStore ?? false);

  // Age gate
  const [ageOn, setAgeOn] = useState(store.ageGate.enabled);
  const [ageMessage, setAgeMessage] = useState(store.ageGate.message);

  const [unpublishOpen, setUnpublishOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const pill = storeStatusPill(status);

  function doUnpublish() {
    startTransition(async () => {
      const res = await unpublishStoreAction();
      if (res.ok && res.status) {
        setStatus(res.status);
        setUnpublishOpen(false);
        toast("Store unpublished");
        router.refresh();
      } else {
        toast(res.error ?? "Couldn't unpublish the store", { tone: "critical" });
      }
    });
  }

  function save() {
    startTransition(async () => {
      const res = await saveStoreSettings({
        name,
        settings: {
          contactEmail,
          currency,
          currencyCode: currencyCode || undefined,
          logoUrl: logo[0] ?? "",
          settlement: { online: payOnline, cod: payCod, inStore: payInStore },
          tax: {
            enabled: taxEnabled,
            rate: Number(taxRate) || 0,
            label: taxLabelV.trim() || "Tax",
            appliesToShipping: taxOnShipping,
          },
          shipping: {
            enabled: shipEnabled,
            rates: rateDrafts.map((r) => {
              const regions = r.regions
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
              const freeOver = r.freeOver.trim() === "" ? null : Number(r.freeOver);
              return {
                id: r.id,
                label: r.label.trim() || "Shipping",
                price: Number(r.price) || 0,
                freeOver: freeOver != null && Number.isFinite(freeOver) ? freeOver : null,
                regions,
              };
            }),
          },
        },
        seoDefaults: { title: seoTitle, description: seoDesc },
        codeInjection: code,
        ageGate: { enabled: ageOn, message: ageMessage },
      });
      if (res.ok) {
        setDirty(false);
        toast("Settings saved");
        router.refresh();
      } else {
        toast("Couldn't save settings", { tone: "critical" });
      }
    });
  }

  return (
    <div style={{ paddingBottom: dirty ? 72 : 0 }}>
      <PageHeader
        title="Settings"
        pill={<Pill tone={pill.tone}>{pill.label}</Pill>}
        actions={
          <Button variant="primary" disabled={!dirty} loading={pending} onClick={save}>
            Save
          </Button>
        }
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-5)",
          maxWidth: 760,
        }}
      >
        {/* Store details */}
        <Card title="Store details">
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <Field label="Store name">
              {(p) => (
                <Input
                  {...p}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    mark();
                  }}
                />
              )}
            </Field>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 200px",
                gap: "var(--space-4)",
              }}
            >
              <Field label="Contact email">
                {(p) => (
                  <Input
                    {...p}
                    type="email"
                    value={contactEmail}
                    onChange={(e) => {
                      setContactEmail(e.target.value);
                      mark();
                    }}
                  />
                )}
              </Field>
              <Field label="Currency" help="One per store — no FX.">
                {(p) => (
                  <select
                    {...p}
                    className="select"
                    value={currencyCode}
                    onChange={(e) => {
                      const code = e.target.value;
                      setCurrencyCode(code);
                      const match = CURRENCIES.find((c) => c.code === code);
                      if (match) setCurrency(match.symbol);
                      mark();
                    }}
                  >
                    <option value="">Custom symbol…</option>
                    {CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} — {c.label}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            </div>
            {currencyCode === "" && (
              <Field label="Currency symbol" help="Shown before amounts, e.g. “$”.">
                {(p) => (
                  <Input
                    {...p}
                    value={currency}
                    style={{ maxWidth: 120 }}
                    onChange={(e) => {
                      setCurrency(e.target.value);
                      mark();
                    }}
                  />
                )}
              </Field>
            )}
          </div>
        </Card>

        {/* Brand & logo */}
        <Card title="Brand & logo">
          <Field
            label="Logo"
            help="Shown in the storefront header and age gate. PNG or SVG."
          >
            <ImageDropzone
              images={logo}
              onChange={(next) => {
                setLogo(next.slice(-1));
                mark();
              }}
              hint="Drop your logo or click to upload"
            />
          </Field>
        </Card>

        {/* Checkout & payment methods */}
        <Card title="Checkout & payment methods">
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--text-muted)",
              marginBottom: "var(--space-4)",
            }}
          >
            High-risk verticals often rely on cash-on-delivery since card processors refuse
            the category.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <SettlementRow
              title="Online payment"
              body="Card / processor checkout (stubbed in the MVP)."
              checked={payOnline}
              onChange={(next) => {
                setPayOnline(next);
                mark();
              }}
            />
            <hr className="divider" />
            <SettlementRow
              title="Cash on delivery"
              body="Shoppers pay the courier when the order arrives."
              checked={payCod}
              onChange={(next) => {
                setPayCod(next);
                mark();
              }}
            />
            <hr className="divider" />
            <SettlementRow
              title="Pay in store"
              body="Shoppers settle on pickup at a physical location."
              checked={payInStore}
              onChange={(next) => {
                setPayInStore(next);
                mark();
              }}
            />
          </div>
        </Card>

        {/* Tax (Phase 2) */}
        <Card
          title={
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              Tax
              <Pill tone={taxEnabled ? "success" : "muted"}>{taxEnabled ? "On" : "Off"}</Pill>
            </span>
          }
          action={
            <Switch
              checked={taxEnabled}
              onChange={(next) => {
                setTaxEnabled(next);
                mark();
              }}
              aria-label="Enable tax"
            />
          }
        >
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--text-muted)",
              marginBottom: "var(--space-4)",
            }}
          >
            Applied to the post-discount subtotal at checkout. Off → no tax is charged.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 140px",
              gap: "var(--space-4)",
              alignItems: "start",
            }}
          >
            <Field label="Tax label" help="Shown on the checkout summary, e.g. “VAT”.">
              {(p) => (
                <Input
                  {...p}
                  value={taxLabelV}
                  disabled={!taxEnabled}
                  onChange={(e) => {
                    setTaxLabelV(e.target.value);
                    mark();
                  }}
                />
              )}
            </Field>
            <Field label="Rate (%)">
              {(p) => (
                <Input
                  {...p}
                  type="number"
                  mono
                  min={0}
                  step="0.01"
                  value={taxRate}
                  disabled={!taxEnabled}
                  onChange={(e) => {
                    setTaxRate(e.target.value);
                    mark();
                  }}
                />
              )}
            </Field>
          </div>
          <div style={{ marginTop: "var(--space-4)" }}>
            <SettlementRow
              title="Tax shipping too"
              body="Include the shipping charge in the taxable amount."
              checked={taxOnShipping}
              onChange={(next) => {
                setTaxOnShipping(next);
                mark();
              }}
            />
          </div>
        </Card>

        {/* Shipping (Phase 2) */}
        <Card
          title={
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              Shipping
              <Pill tone={shipEnabled ? "success" : "muted"}>{shipEnabled ? "On" : "Off"}</Pill>
            </span>
          }
          action={
            <Switch
              checked={shipEnabled}
              onChange={(next) => {
                setShipEnabled(next);
                mark();
              }}
              aria-label="Enable shipping rates"
            />
          }
        >
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--text-muted)",
              marginBottom: "var(--space-4)",
            }}
          >
            Rates shoppers choose at checkout. Off or empty → a single free “Standard” rate.
            Leave “Free over” blank for a flat rate; list regions (comma-separated, e.g. “OR,
            WA”) to limit a rate, or leave blank for everywhere.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {rateDrafts.map((r, i) => (
              <div
                key={r.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.4fr 90px 110px 1fr 32px",
                  gap: "var(--space-2)",
                  alignItems: "center",
                }}
              >
                <Input
                  aria-label="Rate label"
                  placeholder="Standard"
                  value={r.label}
                  disabled={!shipEnabled}
                  onChange={(e) => {
                    const v = e.target.value;
                    setRateDrafts((d) => d.map((x, j) => (j === i ? { ...x, label: v } : x)));
                    mark();
                  }}
                />
                <Input
                  aria-label="Price"
                  type="number"
                  mono
                  min={0}
                  step="0.01"
                  placeholder="Price"
                  value={r.price}
                  disabled={!shipEnabled}
                  onChange={(e) => {
                    const v = e.target.value;
                    setRateDrafts((d) => d.map((x, j) => (j === i ? { ...x, price: v } : x)));
                    mark();
                  }}
                />
                <Input
                  aria-label="Free over"
                  type="number"
                  mono
                  min={0}
                  step="0.01"
                  placeholder="Free over"
                  value={r.freeOver}
                  disabled={!shipEnabled}
                  onChange={(e) => {
                    const v = e.target.value;
                    setRateDrafts((d) => d.map((x, j) => (j === i ? { ...x, freeOver: v } : x)));
                    mark();
                  }}
                />
                <Input
                  aria-label="Regions"
                  placeholder="Regions (all)"
                  value={r.regions}
                  disabled={!shipEnabled}
                  onChange={(e) => {
                    const v = e.target.value;
                    setRateDrafts((d) => d.map((x, j) => (j === i ? { ...x, regions: v } : x)));
                    mark();
                  }}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  icon="trash"
                  aria-label="Remove rate"
                  disabled={!shipEnabled}
                  onClick={() => {
                    setRateDrafts((d) => d.filter((_, j) => j !== i));
                    mark();
                  }}
                />
              </div>
            ))}
            <div>
              <Button
                variant="default"
                size="sm"
                icon="plus"
                disabled={!shipEnabled}
                onClick={() => {
                  setRateDrafts((d) => [
                    ...d,
                    {
                      id: `rate_${Math.random().toString(36).slice(2, 8)}`,
                      label: "",
                      price: "0",
                      freeOver: "",
                      regions: "",
                    },
                  ]);
                  mark();
                }}
              >
                Add rate
              </Button>
            </div>
          </div>
        </Card>

        {/* Domain */}
        <Card title="Domain">
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <Field label="Subdomain" help="Your store's public address.">
              <div className="input-group" style={{ alignItems: "stretch" }}>
                <Input mono value={store.subdomain} readOnly aria-label="Subdomain" />
              </div>
              <div
                className="mono"
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--text-muted)",
                  marginTop: 6,
                }}
              >
                {storeDomain(store.subdomain)}
              </div>
            </Field>
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <Button
                variant="default"
                size="sm"
                onClick={() => toast("Subdomain rename is coming in Stage 7")}
              >
                Rename
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => toast("Availability check is coming in Stage 7")}
              >
                Check availability
              </Button>
            </div>
            <ComingSoonRow
              icon="external"
              title="Custom domain"
              body="Connect your own domain with SSL."
            />
          </div>
        </Card>

        {/* SEO defaults */}
        <Card title="SEO defaults">
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <Field label="Default meta title">
              {(p) => (
                <Input
                  {...p}
                  value={seoTitle}
                  onChange={(e) => {
                    setSeoTitle(e.target.value);
                    mark();
                  }}
                />
              )}
            </Field>
            <Field label="Default meta description">
              {(p) => (
                <Textarea
                  {...p}
                  value={seoDesc}
                  onChange={(e) => {
                    setSeoDesc(e.target.value);
                    mark();
                  }}
                  style={{ minHeight: 64 }}
                />
              )}
            </Field>
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                padding: "var(--space-3)",
                background: "var(--surface-subtle)",
              }}
            >
              <div
                style={{
                  fontSize: "var(--text-2xs)",
                  color: "var(--text-muted)",
                  marginBottom: 4,
                }}
              >
                Search preview
              </div>
              <div style={{ color: "var(--info)", fontSize: "var(--text-base)" }}>
                {seoTitle || store.name}
              </div>
              <div
                className="mono"
                style={{ color: "var(--success)", fontSize: "var(--text-xs)" }}
              >
                {storeDomain(store.subdomain)}
              </div>
              <div style={{ color: "var(--text-muted)", fontSize: "var(--text-xs)" }}>
                {seoDesc || "Add a default description."}
              </div>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: "var(--text-xs)",
                color: "var(--text-muted)",
              }}
            >
              <Icon name="info" size={14} aria-hidden />
              <code>sitemap.xml</code> and <code>robots.txt</code> are generated
              automatically on publish.
            </div>
          </div>
        </Card>

        {/* Code injection */}
        <Card title="Code injection">
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--text-muted)",
              marginBottom: "var(--space-4)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Icon
              name="alertTri"
              size={15}
              style={{ color: "var(--warning)" }}
              aria-hidden
            />
            These run on your live storefront. Code that could affect the Offshelf shell is
            sanitized.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <Field label="<head> HTML">
              <Textarea
                mono
                value={code.headHtml}
                onChange={(e) => {
                  setCode((c) => ({ ...c, headHtml: e.target.value }));
                  mark();
                }}
                style={{ minHeight: 60 }}
                placeholder="<!-- analytics, meta tags -->"
              />
            </Field>
            <Field label="End of <body> HTML">
              <Textarea
                mono
                value={code.bodyHtml}
                onChange={(e) => {
                  setCode((c) => ({ ...c, bodyHtml: e.target.value }));
                  mark();
                }}
                style={{ minHeight: 60 }}
                placeholder="<!-- chat widget, pixels -->"
              />
            </Field>
            <Field label="Custom CSS">
              <Textarea
                mono
                value={code.customCss}
                onChange={(e) => {
                  setCode((c) => ({ ...c, customCss: e.target.value }));
                  mark();
                }}
                style={{ minHeight: 60 }}
                placeholder=".header { }"
              />
            </Field>
            <Field label="Custom JS">
              <Textarea
                mono
                value={code.customJs}
                onChange={(e) => {
                  setCode((c) => ({ ...c, customJs: e.target.value }));
                  mark();
                }}
                style={{ minHeight: 60 }}
                placeholder="// runs on your storefront only"
              />
            </Field>
          </div>
        </Card>

        {/* Age gate */}
        <Card
          title={
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              Age gate
              <Pill tone={ageOn ? "success" : "muted"}>{ageOn ? "On" : "Off"}</Pill>
            </span>
          }
          action={
            <Switch
              checked={ageOn}
              onChange={(next) => {
                setAgeOn(next);
                mark();
              }}
              aria-label="Enable age gate"
            />
          }
        >
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--text-muted)",
              marginBottom: "var(--space-4)",
            }}
          >
            A 21+ compliance interstitial shown before any storefront content. This is a
            legal requirement, not a cosmetic option.
          </p>
          <Field label="Interstitial message">
            <Textarea
              value={ageMessage}
              onChange={(e) => {
                setAgeMessage(e.target.value);
                mark();
              }}
              style={{ minHeight: 60 }}
              disabled={!ageOn}
            />
          </Field>
        </Card>

        {/* Plan & billing — billing is stubbed in the MVP (no processor), so the plan
            is selectable here and switches instantly. Standard unlocks multi-store. */}
        <Card title="Plan & billing">
          <div style={{ display: "grid", gap: "var(--space-3)" }}>
            {plans.map((p) => {
              const active = p.id === currentPlan;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => choosePlan(p.id)}
                  disabled={planPending}
                  aria-pressed={active}
                  style={{
                    textAlign: "left",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "var(--space-4)",
                    padding: "var(--space-4)",
                    borderRadius: "var(--radius-md)",
                    border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                    background: active ? "var(--surface-subtle)" : "transparent",
                    cursor: planPending ? "default" : "pointer",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      <span style={{ fontWeight: 600, color: "var(--text-strong)" }}>
                        {p.name} plan
                      </span>
                      <span
                        className="mono"
                        style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}
                      >
                        {p.priceMonthly === 0 ? "Free" : `${p.currency}${p.priceMonthly}/mo`}
                      </span>
                    </div>
                    <div
                      style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", marginTop: 2 }}
                    >
                      {p.features.join(" · ")}
                    </div>
                  </div>
                  {active ? (
                    <Pill tone="success">Active</Pill>
                  ) : (
                    <span style={{ fontSize: "var(--text-sm)", color: "var(--accent-pressed)", fontWeight: 600 }}>
                      Switch
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", marginTop: "var(--space-3)" }}>
            Billing is provisioned manually in the MVP — switching is instant, no payment.
          </div>
        </Card>

        {/* Danger zone */}
        <Card title={<span style={{ color: "var(--critical)" }}>Danger zone</span>}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <DangerRow
              title={status === "live" ? "Unpublish store" : "Store is not live"}
              body="Takes the storefront offline — the subdomain stops serving. Reverts to draft."
              action={
                <Button
                  variant="critical"
                  disabled={status !== "live"}
                  onClick={() => setUnpublishOpen(true)}
                >
                  Unpublish
                </Button>
              }
            />
            <hr className="divider" />
            <DangerRow
              title="Delete store"
              body="Permanently removes this store, its products, orders, and customers."
              action={
                <Button variant="critical-solid" onClick={() => setDeleteOpen(true)}>
                  Delete store
                </Button>
              }
            />
          </div>
        </Card>
      </div>

      {/* Sticky save bar */}
      {dirty && (
        <div
          style={{
            position: "sticky",
            bottom: 0,
            marginTop: "var(--space-6)",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
            padding: "var(--space-3) var(--space-5)",
            background: "var(--surface)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-md)",
            maxWidth: 760,
          }}
        >
          <span
            style={{
              flex: 1,
              fontSize: "var(--text-sm)",
              fontWeight: 500,
              color: "var(--text-strong)",
            }}
          >
            Unsaved changes
          </span>
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() => {
              setDirty(false);
              router.refresh();
            }}
          >
            Discard
          </Button>
          <Button variant="primary" loading={pending} onClick={save}>
            Save
          </Button>
        </div>
      )}

      {/* Unpublish confirm */}
      <Modal
        open={unpublishOpen}
        onClose={() => setUnpublishOpen(false)}
        title="Unpublish store"
        maxWidth={440}
        footer={
          <>
            <Button variant="ghost" onClick={() => setUnpublishOpen(false)}>
              Cancel
            </Button>
            <Button variant="critical-solid" loading={pending} onClick={doUnpublish}>
              Unpublish {store.name}
            </Button>
          </>
        }
      >
        <p style={{ fontSize: "var(--text-sm)", color: "var(--text)" }}>
          <strong>{store.name}</strong> will go offline immediately. Its subdomain{" "}
          <span className="mono">{storeDomain(store.subdomain)}</span> will stop serving
          until you publish again.
        </p>
      </Modal>

      {/* Delete confirm */}
      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete store"
        maxWidth={440}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="critical-solid"
              onClick={() => {
                setDeleteOpen(false);
                toast("Store deletion is disabled in the demo", { tone: "critical" });
              }}
            >
              Delete {store.name}
            </Button>
          </>
        }
      >
        <p style={{ fontSize: "var(--text-sm)", color: "var(--text)" }}>
          This permanently deletes <strong>{store.name}</strong> and all of its data. This
          cannot be undone.
        </p>
      </Modal>
    </div>
  );
}

function SettlementRow({
  title,
  body,
  checked,
  onChange,
}: {
  title: string;
  body: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--space-4)",
      }}
    >
      <div>
        <div
          style={{
            fontWeight: 500,
            color: "var(--text-strong)",
            fontSize: "var(--text-sm)",
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>{body}</div>
      </div>
      <Switch checked={checked} onChange={onChange} aria-label={title} />
    </div>
  );
}

function ComingSoonRow({
  icon,
  title,
  body,
}: {
  icon: "external";
  title: string;
  body: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        padding: "var(--space-3) var(--space-4)",
        background: "var(--surface-subtle)",
        border: "1px dashed var(--border-strong)",
        borderRadius: "var(--radius-md)",
        opacity: 0.85,
      }}
    >
      <Icon name={icon} size={16} style={{ color: "var(--text-muted)" }} aria-hidden />
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: "var(--text-sm)",
            fontWeight: 500,
            color: "var(--text-strong)",
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>{body}</div>
      </div>
      <Pill tone="muted" dot={false}>
        Coming soon
      </Pill>
    </div>
  );
}

function DangerRow({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--space-4)",
      }}
    >
      <div>
        <div
          style={{
            fontWeight: 500,
            color: "var(--text-strong)",
            fontSize: "var(--text-sm)",
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>{body}</div>
      </div>
      {action}
    </div>
  );
}
