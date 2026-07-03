"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { InventoryAdjustment, InventoryReason, Location } from "@/types";
import type { InventoryRow } from "@/lib/data";
import { adjustStock } from "@/app/(admin)/inventory/actions";
import { setInventoryLevelAction } from "@/app/(admin)/locations/actions";
import Link from "next/link";
import {
  Button,
  EmptyState,
  Field,
  Icon,
  IconButton,
  Input,
  Modal,
  NoResultsState,
  PageHeader,
  Pill,
  Select,
  Sheet,
  Stepper,
  Textarea,
  useToast,
} from "@/components/ui";
import { IndexShell } from "@/components/admin/index-shell";
import { STOCK_LABEL, STOCK_TONE, type StockStatus } from "@/components/admin/shared";
import { fmtDateTime } from "@/lib/format";

/**
 * Inventory (DESIGN §4.6) — its own first-class area. All/Low/Out filter tabs over
 * the per-variant table (product+variant · SKU · on-hand · threshold · status) with
 * an inline stepper quick-edit. "Adjust stock" opens the audit-logged adjustment
 * modal; each row opens its adjustment-history drawer. Local state in Part A.
 */

function statusOf(onHand: number, threshold: number): StockStatus {
  if (onHand <= 0) return "out";
  if (onHand <= threshold) return "low";
  return "in_stock";
}

const REASONS: { value: InventoryReason; label: string }[] = [
  { value: "restock", label: "Restock" },
  { value: "correction", label: "Correction" },
  { value: "manual", label: "Manual" },
];

export function Inventory({
  rows,
  adjustments,
  locations = [],
}: {
  rows: InventoryRow[];
  adjustments: InventoryAdjustment[];
  locations?: Location[];
}) {
  const toast = useToast();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [filter, setFilter] = useState("All");
  const [qty, setQty] = useState<Record<string, number>>(() =>
    Object.fromEntries(rows.map((r) => [r.variant.id, r.onHand])),
  );
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [history, setHistory] = useState<InventoryRow | null>(null);

  const byVariant = useMemo(
    () => new Map(rows.map((r) => [r.variant.id, r])),
    [rows],
  );

  /** Inline stepper quick-edit → an audited "correction" set, optimistic UI. */
  function quickSet(row: InventoryRow, next: number) {
    setQty((q) => ({ ...q, [row.variant.id]: next }));
    startTransition(async () => {
      const res = await adjustStock({
        productId: row.productId,
        variantId: row.variant.id,
        mode: "set",
        amount: next,
        reason: "correction",
      });
      if (!res.ok) toast("Couldn't update stock", { tone: "critical" });
    });
  }

  /** Set a specific location's stock (Phase 6); the sellable total resyncs server-side. */
  function setLevel(variantId: string, locationId: string, amount: number) {
    const row = byVariant.get(variantId);
    if (!row) return;
    setAdjustOpen(false);
    startTransition(async () => {
      const res = await setInventoryLevelAction({
        productId: row.productId,
        variantId,
        locationId,
        quantity: amount,
      });
      if (res.ok) {
        if (res.total !== undefined) setQty((q) => ({ ...q, [variantId]: res.total! }));
        toast("Location stock updated");
        router.refresh();
      } else {
        toast("Couldn't update location stock", { tone: "critical" });
      }
    });
  }

  function applyAdjustment(
    variantId: string,
    mode: "add" | "set",
    amount: number,
    reason: InventoryReason,
    nextQty: number,
  ) {
    const row = byVariant.get(variantId);
    if (!row) return;
    setQty((q) => ({ ...q, [variantId]: nextQty }));
    setAdjustOpen(false);
    startTransition(async () => {
      const res = await adjustStock({
        productId: row.productId,
        variantId,
        mode,
        amount,
        reason,
      });
      if (res.ok) {
        if (res.resultingQuantity !== undefined) {
          setQty((q) => ({ ...q, [variantId]: res.resultingQuantity! }));
        }
        toast("Stock adjusted");
        router.refresh();
      } else {
        toast("Couldn't adjust stock", { tone: "critical" });
      }
    });
  }

  const counts = useMemo(() => {
    let low = 0;
    let out = 0;
    for (const r of rows) {
      const s = statusOf(qty[r.variant.id] ?? r.onHand, r.threshold);
      if (s === "low") low++;
      if (s === "out") out++;
    }
    return { All: rows.length, Low: low, Out: out };
  }, [rows, qty]);

  const visible = rows.filter((r) => {
    const s = statusOf(qty[r.variant.id] ?? r.onHand, r.threshold);
    if (filter === "Low") return s === "low";
    if (filter === "Out") return s === "out";
    return true;
  });

  const historyEntries = history
    ? adjustments.filter((a) => a.variantId === history.variant.id)
    : [];

  return (
    <div>
      <PageHeader
        title="Inventory"
        actions={
          <>
            <Link href="/locations" className="btn btn-md btn-default">
              Locations
            </Link>
            <Button variant="primary" icon="plus" onClick={() => setAdjustOpen(true)}>
              Adjust stock
            </Button>
          </>
        }
      />

      <IndexShell
        tabsLabel="Filter inventory"
        tabs={[
          { value: "All", label: "All", count: counts.All },
          { value: "Low", label: "Low", count: counts.Low },
          { value: "Out", label: "Out", count: counts.Out },
        ]}
        active={filter}
        onTabChange={setFilter}
      >
        {rows.length === 0 ? (
          <EmptyState
            icon="box"
            title="No tracked inventory yet"
            body="Add products with tracked variants to manage their stock here."
            action={
              <Button variant="primary" icon="plus" onClick={() => router.push("/products/new")}>
                Add product
              </Button>
            }
          />
        ) : visible.length === 0 ? (
          <NoResultsState onClear={() => setFilter("All")} label="No variants match this filter" />
        ) : (
          <table className="tbl">
          <thead>
            <tr>
              <th scope="col">Variant</th>
              <th scope="col">SKU</th>
              <th scope="col" className="col-right">
                On hand
              </th>
              <th scope="col" className="col-right">
                Threshold
              </th>
              <th scope="col">Status</th>
              <th scope="col" className="col-right">
                Quick edit
              </th>
              <th scope="col" style={{ width: 44 }} aria-label="History" />
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const onHand = qty[r.variant.id] ?? r.onHand;
              const status = statusOf(onHand, r.threshold);
              return (
                <tr key={r.variant.id} style={{ cursor: "default" }}>
                  <td>
                    <span style={{ fontWeight: 500, color: "var(--text-strong)" }}>
                      {r.productTitle}
                    </span>
                    {r.variant.title !== "Default" && (
                      <span style={{ color: "var(--text-muted)" }}>
                        {" "}
                        · {r.variant.title}
                      </span>
                    )}
                  </td>
                  <td>
                    <span className="mono" style={{ color: "var(--text-muted)" }}>
                      {r.variant.sku}
                    </span>
                  </td>
                  <td className="col-right num">
                    <span
                      style={{
                        color: onHand <= 0 ? "var(--critical)" : "var(--text-strong)",
                      }}
                    >
                      {onHand}
                    </span>
                  </td>
                  <td className="col-right num">
                    <span style={{ color: "var(--text-muted)" }}>{r.threshold}</span>
                  </td>
                  <td>
                    <Pill tone={STOCK_TONE[status]}>{STOCK_LABEL[status]}</Pill>
                  </td>
                  <td className="col-right">
                    <div style={{ display: "inline-flex" }}>
                      <Stepper
                        value={onHand}
                        onChange={(n) => quickSet(r, n)}
                        aria-label={`On-hand quantity for ${r.productTitle} ${r.variant.title}`}
                      />
                    </div>
                  </td>
                  <td className="col-check">
                    <IconButton
                      name="clock"
                      size={28}
                      tip="History"
                      aria-label={`Adjustment history for ${r.productTitle} ${r.variant.title}`}
                      onClick={() => setHistory(r)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
          </table>
        )}
      </IndexShell>

      <AdjustStockModal
        open={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        rows={rows}
        onApply={applyAdjustment}
        onSetLevel={setLevel}
        locations={locations}
        currentQty={qty}
      />

      <Sheet
        open={history !== null}
        onClose={() => setHistory(null)}
        title={
          history
            ? `History · ${history.productTitle}${history.variant.title !== "Default" ? " · " + history.variant.title : ""}`
            : "History"
        }
        width={420}
      >
        {historyEntries.length === 0 ? (
          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
            No adjustments recorded for this variant yet.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {historyEntries.map((a) => (
              <div
                key={a._id}
                style={{
                  display: "flex",
                  gap: "var(--space-3)",
                  paddingBottom: "var(--space-3)",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <span
                  className="mono"
                  style={{
                    fontWeight: 600,
                    width: 44,
                    color: a.delta >= 0 ? "var(--success)" : "var(--critical)",
                  }}
                >
                  {a.delta >= 0 ? `+${a.delta}` : a.delta}
                </span>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: "var(--text-sm)",
                      color: "var(--text-strong)",
                      textTransform: "capitalize",
                    }}
                  >
                    {a.reason}
                    {a.orderId && (
                      <span
                        className="mono"
                        style={{ color: "var(--text-muted)", textTransform: "none" }}
                      >
                        {" "}
                        · #{a.orderId.replace(/^o/, "")}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                    {fmtDateTime(a.createdAt)}
                  </div>
                </div>
                <span
                  className="mono"
                  style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}
                >
                  → {a.resultingQuantity}
                </span>
              </div>
            ))}
          </div>
        )}
      </Sheet>
    </div>
  );
}

function AdjustStockModal({
  open,
  onClose,
  rows,
  currentQty,
  onApply,
  onSetLevel,
  locations,
}: {
  open: boolean;
  onClose: () => void;
  rows: InventoryRow[];
  currentQty: Record<string, number>;
  onApply: (
    variantId: string,
    mode: "add" | "set",
    amount: number,
    reason: InventoryReason,
    nextQty: number,
  ) => void;
  onSetLevel: (variantId: string, locationId: string, amount: number) => void;
  locations: Location[];
}) {
  const [variantId, setVariantId] = useState(rows[0]?.variant.id ?? "");
  const [mode, setMode] = useState<"add" | "set">("add");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState<InventoryReason>("restock");
  const [note, setNote] = useState("");
  // "" → adjust the sellable total (existing behavior); a location id → set that
  // location's stock (Phase 6), which resyncs the total server-side.
  const [locationId, setLocationId] = useState("");
  const multiLocation = locations.length > 1;

  const current = currentQty[variantId] ?? 0;
  const n = parseInt(amount || "0", 10) || 0;
  const resulting = mode === "set" ? n : Math.max(0, current + n);

  function apply() {
    if (locationId) onSetLevel(variantId, locationId, n);
    else onApply(variantId, mode, n, reason, resulting);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Adjust stock"
      maxWidth={460}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!variantId || amount === ""}
            onClick={apply}
          >
            {locationId ? "Set location stock" : "Apply adjustment"}
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <Field label="Variant">
          <Select
            value={variantId}
            onChange={(e) => setVariantId(e.target.value)}
            options={rows.map((r) => ({
              value: r.variant.id,
              label: `${r.productTitle}${r.variant.title !== "Default" ? " · " + r.variant.title : ""}`,
            }))}
          />
        </Field>
        {multiLocation && (
          <Field label="Location">
            <Select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              options={[
                { value: "", label: "All locations (sellable total)" },
                ...locations.map((l) => ({ value: l._id, label: l.name + (l.isDefault ? " · default" : "") })),
              ]}
            />
          </Field>
        )}
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}
        >
          <Field label="Action">
            <Select
              value={mode}
              onChange={(e) => setMode(e.target.value as "add" | "set")}
              options={[
                { value: "add", label: "Add / remove" },
                { value: "set", label: "Set to" },
              ]}
            />
          </Field>
          <Field label={mode === "add" ? "Amount (±)" : "New quantity"}>
            <Input
              mono
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9-]/g, ""))}
              placeholder="0"
            />
          </Field>
        </div>
        <Field label="Reason">
          <Select
            value={reason}
            onChange={(e) => setReason(e.target.value as InventoryReason)}
            options={REASONS}
          />
        </Field>
        <Field label="Note" help="Optional — stored on the audit-log entry.">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={{ minHeight: 60 }}
            placeholder="e.g. New shipment received"
          />
        </Field>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: "var(--text-sm)",
            color: "var(--text-muted)",
          }}
        >
          <Icon name="arrowRight" size={14} aria-hidden />
          Resulting quantity:{" "}
          <span className="mono" style={{ color: "var(--text-strong)", fontWeight: 600 }}>
            {resulting}
          </span>
        </div>
      </div>
    </Modal>
  );
}
