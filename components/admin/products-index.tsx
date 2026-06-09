"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Product } from "@/types";
import {
  bulkSetStatusAction,
  bulkDeleteAction,
  duplicateProductAction,
  removeProduct,
} from "@/app/(admin)/products/actions";
import {
  Button,
  Dropdown,
  EmptyState,
  IconButton,
  MenuItem,
  MenuSeparator,
  NoResultsState,
  PageHeader,
  Pill,
  Thumb,
  useToast,
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
  const [, startTransition] = useTransition();
  const [tab, setTab] = useState("All");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

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
  function bulk(action: "active" | "draft" | "delete") {
    const ids = selected;
    const noun = `${ids.length} product${ids.length === 1 ? "" : "s"}`;
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

  function destroy(id: string, close: () => void) {
    startTransition(async () => {
      await removeProduct(id);
      close();
      toast("Product deleted");
      router.refresh();
    });
  }

  const bulkBar = selected.length > 0 && (
    <div className="bulkbar">
      <span>
        <span className="count">{selected.length}</span> selected
      </span>
      <Button size="sm" variant="default" onClick={() => bulk("active")}>
        Set active
      </Button>
      <Button size="sm" variant="default" onClick={() => bulk("draft")}>
        Set draft
      </Button>
      <Button size="sm" variant="critical" onClick={() => bulk("delete")}>
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
