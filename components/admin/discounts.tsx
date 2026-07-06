"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Discount, DiscountStatus, DiscountType } from "@/types";
import type { DiscountInput } from "@/lib/data";
import {
  Button,
  Card,
  Dropdown,
  EmptyState,
  Field,
  IconButton,
  Input,
  MenuItem,
  MenuSeparator,
  Modal,
  PageHeader,
  Pill,
  Select,
  Switch,
  useToast,
  useConfirm,
} from "@/components/ui";
import {
  createDiscountAction,
  deleteDiscountAction,
  updateDiscountAction,
} from "@/app/(admin)/discounts/actions";
import { fmtDate, money } from "@/lib/format";

/**
 * Discounts index (PRD §6.4 — promo codes). Lists codes with their type/value,
 * minimum subtotal, redemption count, validity window, and status; create/edit via
 * a Modal form; delete via the row menu. Codes are validated + applied SERVER-SIDE
 * at checkout (see `lib/data/discounts`), so this screen is purely authoring.
 */

interface DraftState {
  code: string;
  type: DiscountType;
  value: string;
  minSubtotal: string;
  usageLimit: string;
  startsAt: string;
  endsAt: string;
  status: DiscountStatus;
}

const EMPTY_DRAFT: DraftState = {
  code: "",
  type: "percentage",
  value: "",
  minSubtotal: "",
  usageLimit: "",
  startsAt: "",
  endsAt: "",
  status: "active",
};

/** ISO timestamp → `yyyy-mm-dd` for a native date input (empty when absent). */
function isoToDateValue(iso?: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

/** `yyyy-mm-dd` from a date input → ISO timestamp, or null when blank. */
function dateValueToIso(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  const d = new Date(`${v}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function draftFromDiscount(d: Discount): DraftState {
  return {
    code: d.code,
    type: d.type,
    value: String(d.value),
    minSubtotal: d.minSubtotal ? String(d.minSubtotal) : "",
    usageLimit: d.usageLimit != null ? String(d.usageLimit) : "",
    startsAt: isoToDateValue(d.startsAt),
    endsAt: isoToDateValue(d.endsAt),
    status: d.status,
  };
}

/** "20% off" or "$10 off" — the human label for a code's reward. */
function rewardLabel(type: DiscountType, value: number, currency: string): string {
  return type === "percentage" ? `${value}% off` : `${money(value, currency)} off`;
}

export function Discounts({
  discounts,
  currency,
}: {
  discounts: Discount[];
  currency: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [pending, startTransition] = useTransition();

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [error, setError] = useState<string | null>(null);

  function patch<K extends keyof DraftState>(key: K, value: DraftState[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function openCreate() {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setError(null);
    setOpen(true);
  }

  function openEdit(d: Discount) {
    setEditingId(d._id);
    setDraft(draftFromDiscount(d));
    setError(null);
    setOpen(true);
  }

  function save() {
    const code = draft.code.trim();
    const value = Number(draft.value);
    if (!code) {
      setError("Enter a discount code.");
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter a value greater than 0.");
      return;
    }
    if (draft.type === "percentage" && value > 100) {
      setError("A percentage discount can't exceed 100%.");
      return;
    }

    const minSubtotal = draft.minSubtotal.trim() ? Number(draft.minSubtotal) : 0;
    const usageLimit = draft.usageLimit.trim() ? Number(draft.usageLimit) : null;
    if (Number.isNaN(minSubtotal) || minSubtotal < 0) {
      setError("Minimum subtotal must be 0 or more.");
      return;
    }
    if (usageLimit != null && (!Number.isInteger(usageLimit) || usageLimit < 1)) {
      setError("Usage limit must be a whole number of 1 or more.");
      return;
    }

    const input: DiscountInput = {
      code,
      type: draft.type,
      value,
      minSubtotal,
      usageLimit,
      startsAt: dateValueToIso(draft.startsAt),
      endsAt: dateValueToIso(draft.endsAt),
      status: draft.status,
    };

    setError(null);
    startTransition(async () => {
      const res = editingId
        ? await updateDiscountAction(editingId, input)
        : await createDiscountAction(input);
      if (res.ok) {
        setOpen(false);
        toast(editingId ? "Discount updated" : "Discount created");
        router.refresh();
      } else {
        setError(res.error ?? "Couldn't save the discount.");
      }
    });
  }

  async function destroy(id: string, close: () => void) {
    close();
    const d = discounts.find((x) => x._id === id);
    const ok = await confirm({
      title: "Delete discount?",
      message: `${d ? `Code “${d.code}”` : "This discount"} will be permanently deleted. This can’t be undone.`,
      confirmLabel: "Delete discount",
      destructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await deleteDiscountAction(id);
      if (res.ok) {
        toast("Discount deleted");
        router.refresh();
      } else {
        toast("Couldn't delete the discount", { tone: "critical" });
      }
    });
  }

  return (
    <div>
      <PageHeader
        title="Discounts"
        actions={
          <Button variant="primary" icon="plus" onClick={openCreate}>
            Create discount
          </Button>
        }
      />

      {discounts.length === 0 ? (
        <EmptyState
          icon="tag"
          title="No discounts yet"
          body="Create promo codes shoppers can apply at checkout."
          action={
            <Button variant="primary" icon="plus" onClick={openCreate}>
              Create discount
            </Button>
          }
        />
      ) : (
        <Card pad={false}>
          <div style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Code</th>
                <th scope="col">Value</th>
                <th scope="col" className="col-right">
                  Min subtotal
                </th>
                <th scope="col" className="col-right">
                  Used
                </th>
                <th scope="col">Validity</th>
                <th scope="col">Status</th>
                <th scope="col" style={{ width: 44 }} aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {discounts.map((d) => {
                const validity = validityLabel(d.startsAt, d.endsAt);
                return (
                  <tr
                    key={d._id}
                    className="is-clickable"
                    onClick={() => openEdit(d)}
                  >
                    <td>
                      <span className="mono" style={{ fontWeight: 600, color: "var(--text-strong)" }}>
                        {d.code}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: "var(--text)" }}>
                        {rewardLabel(d.type, d.value, currency)}
                      </span>
                    </td>
                    <td className="col-right num">
                      <span style={{ color: "var(--text-muted)" }}>
                        {d.minSubtotal > 0 ? money(d.minSubtotal, currency) : "—"}
                      </span>
                    </td>
                    <td className="col-right num">
                      <span style={{ color: "var(--text)" }}>
                        {d.usedCount}/{d.usageLimit != null ? d.usageLimit : "∞"}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>
                        {validity}
                      </span>
                    </td>
                    <td>
                      <Pill tone={d.status === "active" ? "success" : "muted"}>
                        {d.status === "active" ? "Active" : "Disabled"}
                      </Pill>
                    </td>
                    <td className="col-check" onClick={(e) => e.stopPropagation()}>
                      <Dropdown
                        trigger={
                          <IconButton
                            name="dots"
                            size={28}
                            aria-label={`Actions for ${d.code}`}
                          />
                        }
                      >
                        {(close) => (
                          <>
                            <MenuItem
                              icon="eye"
                              onClick={() => {
                                openEdit(d);
                                close();
                              }}
                            >
                              Edit
                            </MenuItem>
                            <MenuSeparator />
                            <MenuItem
                              icon="trash"
                              danger
                              onClick={() => destroy(d._id, close)}
                            >
                              Delete
                            </MenuItem>
                          </>
                        )}
                      </Dropdown>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </Card>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editingId ? "Edit discount" : "Create discount"}
        maxWidth={560}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="primary" loading={pending} onClick={save}>
              {editingId ? "Save discount" : "Create discount"}
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          {error && (
            <div
              role="alert"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "var(--space-3) var(--space-4)",
                borderRadius: "var(--radius-md)",
                background: "var(--critical-bg)",
                color: "var(--critical)",
                fontSize: "var(--text-sm)",
              }}
            >
              {error}
            </div>
          )}

          <Field label="Discount code" required>
            {(p) => (
              <Input
                {...p}
                mono
                value={draft.code}
                placeholder="SUMMER20"
                autoFocus
                onChange={(e) => patch("code", e.target.value.toUpperCase())}
              />
            )}
          </Field>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "var(--space-4)",
            }}
          >
            <Field label="Type">
              {(p) => (
                <Select
                  {...p}
                  value={draft.type}
                  onChange={(e) => patch("type", e.target.value as DiscountType)}
                  options={[
                    { value: "percentage", label: "Percentage" },
                    { value: "fixed", label: "Fixed amount" },
                  ]}
                />
              )}
            </Field>
            <Field
              label="Value"
              required
              help={draft.type === "percentage" ? "Percent off (0–100)." : "Amount off."}
            >
              {(p) => (
                <Input
                  {...p}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={draft.value}
                  onChange={(e) => patch("value", e.target.value)}
                />
              )}
            </Field>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "var(--space-4)",
            }}
          >
            <Field label="Minimum subtotal" help="Optional. Leave blank for none.">
              {(p) => (
                <Input
                  {...p}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={draft.minSubtotal}
                  placeholder="0"
                  onChange={(e) => patch("minSubtotal", e.target.value)}
                />
              )}
            </Field>
            <Field label="Usage limit" help="Optional. Blank = unlimited.">
              {(p) => (
                <Input
                  {...p}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={draft.usageLimit}
                  placeholder="∞"
                  onChange={(e) => patch("usageLimit", e.target.value)}
                />
              )}
            </Field>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "var(--space-4)",
            }}
          >
            <Field label="Starts" help="Optional.">
              {(p) => (
                <Input
                  {...p}
                  type="date"
                  value={draft.startsAt}
                  onChange={(e) => patch("startsAt", e.target.value)}
                />
              )}
            </Field>
            <Field label="Ends" help="Optional.">
              {(p) => (
                <Input
                  {...p}
                  type="date"
                  value={draft.endsAt}
                  onChange={(e) => patch("endsAt", e.target.value)}
                />
              )}
            </Field>
          </div>

          <Field label="Active">
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              <Switch
                checked={draft.status === "active"}
                onChange={(next) => patch("status", next ? "active" : "disabled")}
                aria-label="Discount active"
              />
              <span style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                {draft.status === "active"
                  ? "Shoppers can apply this code at checkout."
                  : "Disabled — the code is rejected at checkout."}
              </span>
            </div>
          </Field>
        </div>
      </Modal>
    </div>
  );
}

/** Human validity window: a date range, an open-ended bound, or "No limit". */
function validityLabel(startsAt?: string | null, endsAt?: string | null): string {
  if (startsAt && endsAt) return `${fmtDate(startsAt)} – ${fmtDate(endsAt)}`;
  if (startsAt) return `From ${fmtDate(startsAt)}`;
  if (endsAt) return `Until ${fmtDate(endsAt)}`;
  return "No limit";
}
