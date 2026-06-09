"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Collection, Product } from "@/types";
import {
  Button,
  Card,
  Dropdown,
  Field,
  Icon,
  IconButton,
  Input,
  MenuItem,
  MenuSeparator,
  PageHeader,
  Thumb,
  useToast,
  slugify,
} from "@/components/ui";
import { storeDomain } from "@/lib/format";
import { saveCollection, removeCollection } from "@/app/(admin)/collections/actions";

/**
 * Collection editor (Stage 9, PRD §5.5) — title · handle · manual product
 * membership (a searchable product checklist; no smart rules). Membership order
 * follows the order products are added, which the storefront collection page
 * preserves. Wired to the `saveCollection` / `removeCollection` actions.
 */
export function CollectionEditor({
  collection,
  products,
  storeSubdomain,
}: {
  collection: Collection | null;
  products: Product[];
  storeSubdomain: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const isNew = collection === null;
  const [pending, startTransition] = useTransition();

  const [dirty, setDirty] = useState(isNew);
  const [title, setTitle] = useState(collection?.title ?? "");
  const [handle, setHandle] = useState(collection?.handle ?? "");
  const [handleEdited, setHandleEdited] = useState(!isNew);
  const [selected, setSelected] = useState<string[]>(collection?.productIds ?? []);
  const [query, setQuery] = useState("");

  const mark = () => setDirty(true);
  const previewBase = `${storeDomain(storeSubdomain)}/collections/`;

  function onTitle(v: string) {
    setTitle(v);
    if (!handleEdited) setHandle(slugify(v));
    mark();
  }
  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
    mark();
  }

  const visibleProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.title.toLowerCase().includes(q));
  }, [products, query]);

  function save() {
    if (!title.trim()) {
      toast("Add a collection title first", { tone: "critical" });
      return;
    }
    if (!handle.trim()) {
      toast("Add a handle first", { tone: "critical" });
      return;
    }
    startTransition(async () => {
      const res = await saveCollection(collection?._id ?? null, {
        title: title.trim(),
        handle: handle.trim(),
        productIds: selected,
      });
      if (!res.ok) {
        toast(res.error ?? "Couldn't save", { tone: "critical" });
        return;
      }
      setDirty(false);
      toast(isNew ? "Collection created" : "Collection saved");
      if (isNew) router.push("/collections");
      else router.refresh();
    });
  }
  function discard() {
    if (isNew) router.push("/collections");
    else router.refresh();
    setDirty(false);
  }
  function destroy(close: () => void) {
    if (!collection) return;
    startTransition(async () => {
      await removeCollection(collection._id);
      close();
      toast("Collection deleted");
      router.push("/collections");
    });
  }

  return (
    <div style={{ paddingBottom: dirty ? 72 : 0 }}>
      <PageHeader
        breadcrumb={
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            style={{ padding: "0 6px", marginLeft: -6, color: "var(--text-muted)" }}
            onClick={() => router.push("/collections")}
          >
            <Icon name="chevronLeft" size={15} aria-hidden /> Collections
          </button>
        }
        title={isNew ? "New collection" : title || "Untitled collection"}
        actions={
          <>
            <Button variant="primary" disabled={!dirty} loading={pending} onClick={save}>
              {isNew ? "Create" : "Save"}
            </Button>
            {!isNew && (
              <Dropdown
                trigger={<IconButton name="dots" size={36} aria-label="More actions" />}
              >
                {(close) => (
                  <>
                    <MenuItem
                      icon="external"
                      onClick={() => {
                        window.open(`${previewBase}${handle}`, "_blank");
                        close();
                      }}
                    >
                      View on store
                    </MenuItem>
                    <MenuSeparator />
                    <MenuItem icon="trash" danger onClick={() => destroy(close)}>
                      Delete collection
                    </MenuItem>
                  </>
                )}
              </Dropdown>
            )}
          </>
        }
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr",
          gap: "var(--space-5)",
          alignItems: "start",
        }}
      >
        {/* Products membership */}
        <Card
          title="Products"
          action={
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
              {selected.length} selected
            </span>
          }
        >
          <div style={{ marginBottom: "var(--space-3)" }}>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products to add…"
              aria-label="Search products"
            />
          </div>
          {visibleProducts.length === 0 ? (
            <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
              {products.length === 0 ? "No products yet." : "No products match your search."}
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {visibleProducts.map((p) => {
                const isSel = selected.includes(p._id);
                return (
                  <label
                    key={p._id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "var(--space-2) 0",
                      borderBottom: "1px solid var(--border)",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={isSel}
                      onChange={() => toggle(p._id)}
                      aria-label={`Add ${p.title} to collection`}
                    />
                    <Thumb size={32} src={p.images[0]} alt="" />
                    <span
                      style={{
                        flex: 1,
                        fontSize: "var(--text-sm)",
                        color: "var(--text-strong)",
                      }}
                    >
                      {p.title}
                    </span>
                    {isSel && (
                      <Icon
                        name="check"
                        size={15}
                        style={{ color: "var(--accent-pressed)" }}
                        aria-hidden
                      />
                    )}
                  </label>
                );
              })}
            </div>
          )}
        </Card>

        {/* Details */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
          <Card title="Details">
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              <Field label="Title">
                {(p) => (
                  <Input
                    {...p}
                    value={title}
                    onChange={(e) => onTitle(e.target.value)}
                    placeholder="e.g. Flower"
                  />
                )}
              </Field>
              <Field label="Handle / URL">
                <Input
                  mono
                  value={handle}
                  spellCheck={false}
                  onChange={(e) => {
                    setHandle(slugify(e.target.value));
                    setHandleEdited(true);
                    mark();
                  }}
                  aria-label="Handle"
                />
                <div
                  className="mono"
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--text-muted)",
                    marginTop: 6,
                    wordBreak: "break-all",
                  }}
                >
                  {previewBase}
                  <b style={{ color: "var(--text)" }}>{handle || "handle"}</b>
                </div>
              </Field>
            </div>
          </Card>
        </div>
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
            {isNew ? "New collection — not saved yet" : "Unsaved changes"}
          </span>
          <Button variant="ghost" onClick={discard} disabled={pending}>
            Discard
          </Button>
          <Button variant="primary" onClick={save} loading={pending}>
            {isNew ? "Create" : "Save"}
          </Button>
        </div>
      )}
    </div>
  );
}
