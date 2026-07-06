"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Product } from "@/types";
import {
  bulkSetStatusAction,
  bulkDeleteAction,
  bulkEditAction,
  exportProductsCsv,
  importProductsAction,
  duplicateProductAction,
  removeProduct,
} from "@/app/(admin)/products/actions";
import type { BulkProductEdit } from "@/lib/data";
import {
  Button,
  Dropdown,
  EmptyState,
  Field,
  IconButton,
  Input,
  MenuItem,
  MenuSeparator,
  Modal,
  NoResultsState,
  PageHeader,
  Pill,
  Thumb,
  useToast,
  useConfirm,
} from "@/components/ui";
import { IndexShell } from "@/components/admin/index-shell";
import {
  STOCK_LABEL,
  priceRange,
  productInventory,
  productStatusPill,
} from "@/components/admin/shared";

/**
 * Products index (DESIGN §4.5) — the §3.4 index table with All/Active/Draft view
 * tabs (counts), title/SKU search, select-all + bulk actions (set active/draft/
 * delete), and a per-row menu (view/duplicate/delete). Row → product editor.
 */
export function ProductsIndex({ products }: { products: Product[] }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState("All");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const counts = useMemo(
    () => ({
      All: products.length,
      Active: products.filter((p) => p.status === "active").length,
      Draft: products.filter((p) => p.status === "draft").length,
    }),
    [products],
  );

  const rows = useMemo(() => {
    let r = products;
    if (tab === "Active") r = r.filter((p) => p.status === "active");
    if (tab === "Draft") r = r.filter((p) => p.status === "draft");
    const q = query.trim().toLowerCase();
    if (q) {
      r = r.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.variants.some((v) => v.sku.toLowerCase().includes(q)),
      );
    }
    return r;
  }, [products, tab, query]);

  const allSelected = rows.length > 0 && rows.every((p) => selected.includes(p._id));
  function toggleAll() {
    setSelected(allSelected ? [] : rows.map((p) => p._id));
  }
  function toggleRow(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }
  async function bulk(action: "active" | "draft" | "delete") {
    const ids = selected;
    const noun = `${ids.length} product${ids.length === 1 ? "" : "s"}`;
    if (action === "delete") {
      const ok = await confirm({
        title: `Delete ${noun}?`,
        message: `${noun} will be permanently deleted. This can’t be undone.`,
        confirmLabel: `Delete ${noun}`,
        destructive: true,
      });
      if (!ok) return;
    }
    startTransition(async () => {
      if (action === "delete") {
        await bulkDeleteAction(ids);
        toast(`${noun} deleted`);
      } else {
        await bulkSetStatusAction(ids, action);
        toast(`${noun} set ${action}`);
      }
      setSelected([]);
      router.refresh();
    });
  }

  function exportCsv() {
    startTransition(async () => {
      const res = await exportProductsCsv();
      if (!res.ok || !res.csv) {
        toast("Couldn't export products", { tone: "critical" });
        return;
      }
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "products.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast("Products exported");
    });
  }

  function runImport(csv: string, done: (errors: string[]) => void) {
    startTransition(async () => {
      const res = await importProductsAction(csv);
      if (res.created || res.updated) {
        toast(`Imported — ${res.created} created, ${res.updated} updated`);
        router.refresh();
      }
      done(res.errors);
    });
  }

  function runBulkEdit(edit: BulkProductEdit) {
    const ids = selected;
    startTransition(async () => {
      const res = await bulkEditAction(ids, edit);
      if (res.ok) {
        toast(`${res.count} product${res.count === 1 ? "" : "s"} updated`);
        setSelected([]);
        setBulkEditOpen(false);
        router.refresh();
      } else {
        toast(res.error ?? "Couldn't apply changes", { tone: "critical" });
      }
    });
  }

  function duplicate(id: string, close: () => void) {
    startTransition(async () => {
      const res = await duplicateProductAction(id);
      close();
      if (res.ok) {
        toast("Product duplicated");
        router.refresh();
      } else {
        toast(res.error ?? "Couldn't duplicate", { tone: "critical" });
      }
    });
  }

  async function destroy(id: string, close: () => void) {
    close();
    const product = products.find((p) => p._id === id);
    const ok = await confirm({
      title: "Delete product?",
      message: `${product ? `“${product.title}”` : "This product"} will be permanently deleted. This can’t be undone.`,
      confirmLabel: "Delete product",
      destructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      await removeProduct(id);
      toast("Product deleted");
      router.refresh();
    });
  }

  const bulkBar = selected.length > 0 && (
    <div className="bulkbar">
      <span>
        <span className="count">{selected.length}</span> selected
      </span>
      <Button size="sm" variant="default" disabled={pending} onClick={() => bulk("active")}>
        Set active
      </Button>
      <Button size="sm" variant="default" disabled={pending} onClick={() => bulk("draft")}>
        Set draft
      </Button>
      <Button size="sm" variant="default" disabled={pending} onClick={() => setBulkEditOpen(true)}>
        Edit
      </Button>
      <Button size="sm" variant="critical" disabled={pending} onClick={() => bulk("delete")}>
        Delete
      </Button>
      <span className="spacer" />
      <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
        Page 1 of 1
      </span>
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Products"
        actions={
          <>
            <Button variant="default" icon="layers" onClick={() => router.push("/collections")}>
              Collections
            </Button>
            <Button variant="default" icon="download" onClick={exportCsv}>
              Export
            </Button>
            <Button variant="default" icon="upload" onClick={() => setImportOpen(true)}>
              Import
            </Button>
            <Button
              variant="primary"
              icon="plus"
              onClick={() => router.push("/products/new")}
            >
              Add product
            </Button>
          </>
        }
      />

      {bulkEditOpen && (
        <BulkEditModal
          count={selected.length}
          onClose={() => setBulkEditOpen(false)}
          onApply={runBulkEdit}
        />
      )}
      {importOpen && <ImportModal onClose={() => setImportOpen(false)} onImport={runImport} />}

      <IndexShell
        tabsLabel="Filter products"
        tabs={[
          { value: "All", label: "All", count: counts.All },
          { value: "Active", label: "Active", count: counts.Active },
          { value: "Draft", label: "Draft", count: counts.Draft },
        ]}
        active={tab}
        onTabChange={setTab}
        query={query}
        onQueryChange={setQuery}
        searchPlaceholder="Search by title or SKU"
        footer={bulkBar}
      >
        {products.length === 0 ? (
          <EmptyState
            icon="box"
            title="No products yet"
            body="Add your first product to start building your catalog."
            action={
              <Button variant="primary" icon="plus" onClick={() => router.push("/products/new")}>
                Add product
              </Button>
            }
          />
        ) : rows.length === 0 ? (
          <NoResultsState
            onClear={() => {
              setQuery("");
              setTab("All");
            }}
          />
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th className="col-check">
                  <input
                    type="checkbox"
                    className="checkbox"
                    aria-label="Select all products"
                    checked={allSelected}
                    onChange={toggleAll}
                  />
                </th>
                <th scope="col">Product</th>
                <th scope="col">Status</th>
                <th scope="col">Inventory</th>
                <th scope="col" className="col-right">
                  Price
                </th>
                <th scope="col" style={{ width: 44 }} aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const status = productStatusPill(p.status);
                const inv = productInventory(p);
                const isSel = selected.includes(p._id);
                return (
                  <tr
                    key={p._id}
                    className={`is-clickable${isSel ? " is-selected" : ""}`}
                    onClick={() => router.push(`/products/edit/${p._id}`)}
                  >
                    <td className="col-check" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="checkbox"
                        aria-label={`Select ${p.title}`}
                        checked={isSel}
                        onChange={() => toggleRow(p._id)}
                      />
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Thumb size={36} src={p.images[0]} alt="" />
                        <div>
                          <div style={{ fontWeight: 500, color: "var(--text-strong)" }}>
                            {p.title}
                          </div>
                          <div
                            style={{
                              fontSize: "var(--text-xs)",
                              color: "var(--text-muted)",
                            }}
                          >
                            {p.variants.length} variant{p.variants.length === 1 ? "" : "s"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <Pill tone={status.tone}>{status.label}</Pill>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span
                          className="mono"
                          style={{
                            color: inv.status === "out" ? "var(--critical)" : "var(--text)",
                          }}
                        >
                          {inv.total}
                        </span>
                        <span
                          style={{
                            fontSize: "var(--text-xs)",
                            color:
                              inv.status === "in_stock"
                                ? "var(--text-muted)"
                                : inv.status === "low"
                                  ? "var(--warning)"
                                  : "var(--critical)",
                          }}
                        >
                          {STOCK_LABEL[inv.status].toLowerCase()}
                        </span>
                      </div>
                    </td>
                    <td className="col-right num">
                      <span style={{ color: "var(--text-strong)" }}>{priceRange(p)}</span>
                    </td>
                    <td className="col-check" onClick={(e) => e.stopPropagation()}>
                      <Dropdown
                        trigger={
                          <IconButton
                            name="dots"
                            size={28}
                            aria-label={`Actions for ${p.title}`}
                          />
                        }
                      >
                        {(close) => (
                          <>
                            <MenuItem
                              icon="eye"
                              onClick={() => {
                                router.push(`/products/edit/${p._id}`);
                                close();
                              }}
                            >
                              View
                            </MenuItem>
                            <MenuItem icon="copy" onClick={() => duplicate(p._id, close)}>
                              Duplicate
                            </MenuItem>
                            <MenuSeparator />
                            <MenuItem
                              icon="trash"
                              danger
                              onClick={() => destroy(p._id, close)}
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
        )}
      </IndexShell>
    </div>
  );
}

/** Bulk-edit modal (Phase 4) — apply one set of changes across the selected products. */
function BulkEditModal({
  count,
  onClose,
  onApply,
}: {
  count: number;
  onClose: () => void;
  onApply: (edit: BulkProductEdit) => void;
}) {
  const [status, setStatus] = useState<"" | "active" | "draft">("");
  const [productType, setProductType] = useState("");
  const [vendor, setVendor] = useState("");
  const [addTags, setAddTags] = useState("");
  const [removeTags, setRemoveTags] = useState("");
  const [pricePct, setPricePct] = useState("");

  const splitTags = (s: string) => s.split(",").map((t) => t.trim()).filter(Boolean);

  function apply() {
    const edit: BulkProductEdit = {};
    if (status) edit.status = status;
    if (productType.trim()) edit.productType = productType.trim();
    if (vendor.trim()) edit.vendor = vendor.trim();
    if (splitTags(addTags).length) edit.addTags = splitTags(addTags);
    if (splitTags(removeTags).length) edit.removeTags = splitTags(removeTags);
    const pct = Number(pricePct);
    if (pricePct.trim() && Number.isFinite(pct) && pct !== 0) edit.priceAdjustPct = pct;
    onApply(edit);
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit ${count} product${count === 1 ? "" : "s"}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={apply}>
            Apply
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
          Only the fields you fill in are changed; the rest are left as-is.
        </p>
        <Field label="Status">
          <select
            className="input"
            value={status}
            onChange={(e) => setStatus(e.target.value as "" | "active" | "draft")}
          >
            <option value="">No change</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
          </select>
        </Field>
        <Field label="Product type">
          <Input value={productType} onChange={(e) => setProductType(e.target.value)} placeholder="No change" />
        </Field>
        <Field label="Vendor">
          <Input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="No change" />
        </Field>
        <Field label="Add tags" help="Comma-separated">
          <Input value={addTags} onChange={(e) => setAddTags(e.target.value)} placeholder="e.g. sale, new" />
        </Field>
        <Field label="Remove tags" help="Comma-separated">
          <Input value={removeTags} onChange={(e) => setRemoveTags(e.target.value)} />
        </Field>
        <Field label="Adjust prices %" help="e.g. 10 raises by 10%, −15 cuts by 15%">
          <Input mono value={pricePct} onChange={(e) => setPricePct(e.target.value)} placeholder="0" />
        </Field>
      </div>
    </Modal>
  );
}

/** CSV import modal (Phase 4) — paste CSV or pick a .csv file, then upsert by handle. */
function ImportModal({
  onClose,
  onImport,
}: {
  onClose: () => void;
  onImport: (csv: string, done: (errors: string[]) => void) => void;
}) {
  const [text, setText] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then(setText);
  }

  function submit() {
    if (!text.trim()) {
      setErrors(["Paste CSV or choose a file first."]);
      return;
    }
    setBusy(true);
    setErrors([]);
    onImport(text, (errs) => {
      setBusy(false);
      if (errs.length) setErrors(errs);
      else onClose();
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Import products"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={busy}>
            Import
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
          Columns: <code>handle, title, price</code> (required) plus optional{" "}
          <code>description, status, productType, vendor, tags, compareAtPrice, sku, barcode, quantity</code>.
          Existing handles are updated; new ones are created. One primary variant per row.
        </p>
        <input type="file" accept=".csv,text/csv" onChange={pickFile} aria-label="Choose CSV file" />
        <textarea
          className="input"
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="…or paste CSV here"
          style={{ resize: "vertical", fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)" }}
        />
        {errors.length > 0 && (
          <div
            style={{
              maxHeight: 140,
              overflow: "auto",
              fontSize: "var(--text-xs)",
              color: "var(--critical)",
              background: "var(--critical-bg)",
              borderRadius: "var(--radius-md)",
              padding: "var(--space-2) var(--space-3)",
            }}
          >
            {errors.map((er, i) => (
              <div key={i}>{er}</div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
