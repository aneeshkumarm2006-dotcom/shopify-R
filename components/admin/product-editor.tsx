"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  Collection,
  InventoryPolicy,
  Product,
  ProductInput,
  ProductOption,
  ProductStatus,
  Variant,
} from "@/types";
import {
  Button,
  Card,
  Dropdown,
  Eyebrow,
  Field,
  Icon,
  IconButton,
  ImageDropzone,
  Input,
  MenuItem,
  MenuSeparator,
  PageHeader,
  Pill,
  PriceInput,
  RichTextInput,
  Select,
  Switch,
  useToast,
} from "@/components/ui";
import { productStatusPill } from "@/components/admin/shared";
import { storeDomain } from "@/lib/format";
import { slugify } from "@/components/ui";
import {
  saveProduct,
  removeProduct,
  duplicateProductAction,
} from "@/app/(admin)/products/actions";

/**
 * Product editor (DESIGN §4.5) — the two-column create/edit form, wired to real
 * persistence in Stage 9 (PRD §6.4). Main column: title · rich-text description ·
 * Cloudinary media dropzone · options builder + variant table (SKU/barcode/price/
 * compare-at/qty/threshold/track/policy). Side column: status · collections
 * membership · handle/URL · per-product SEO override. A sticky save bar drives the
 * `saveProduct` server action; delete/duplicate hit their actions too.
 */

interface EditableVariant {
  id: string;
  title: string;
  sku: string;
  barcode: string;
  price: number;
  compareAt: number | null;
  qty: number;
  threshold: number;
  policy: InventoryPolicy;
  track: boolean;
}

function blankVariant(id: string, title: string): EditableVariant {
  return {
    id,
    title,
    sku: "",
    barcode: "",
    price: 0,
    compareAt: null,
    qty: 0,
    threshold: 0,
    policy: "deny",
    track: true,
  };
}

function toEditable(p: Product | null): EditableVariant[] {
  if (!p || p.variants.length === 0) return [blankVariant("v1", "Default")];
  return p.variants.map((v) => ({
    id: v.id,
    title: v.title,
    sku: v.sku,
    barcode: v.barcode ?? "",
    price: v.price,
    compareAt: v.compareAtPrice ?? null,
    qty: v.inventory.quantity,
    threshold: v.inventory.lowStockThreshold,
    policy: v.inventory.policy,
    track: v.inventory.trackInventory,
  }));
}

let variantSeq = 0;
const newVariantId = () => `v_${Date.now().toString(36)}${(variantSeq++).toString(36)}`;

/** Cartesian product of each option's value list → ordered combinations. */
function cartesian(lists: string[][]): string[][] {
  return lists.reduce<string[][]>(
    (acc, vals) => acc.flatMap((combo) => vals.map((v) => [...combo, v])),
    [[]],
  );
}

/**
 * Rebuild the variant matrix from the options, carrying over any existing
 * variant's data by matching title so edits aren't lost when values change.
 */
function regenerate(options: ProductOption[], current: EditableVariant[]): EditableVariant[] {
  const usable = options
    .map((o) => ({ name: o.name.trim(), values: o.values.map((v) => v.trim()).filter(Boolean) }))
    .filter((o) => o.name && o.values.length > 0);

  if (usable.length === 0) {
    // No options → a single default variant, preserving the first row's data.
    const base = current[0] ?? blankVariant("v1", "Default");
    return [{ ...base, title: "Default" }];
  }

  const byTitle = new Map(current.map((v) => [v.title, v]));
  const combos = cartesian(usable.map((o) => o.values));
  return combos.map((combo) => {
    const title = combo.join(" / ");
    const existing = byTitle.get(title);
    return existing ? { ...existing, title } : { ...blankVariant(newVariantId(), title) };
  });
}

export function ProductEditor({
  product,
  collections,
  memberOf,
  storeSubdomain,
}: {
  product: Product | null;
  collections: Collection[];
  /** Collection ids this product currently belongs to. */
  memberOf: string[];
  storeSubdomain: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const isNew = product === null;
  const [pending, startTransition] = useTransition();

  const [dirty, setDirty] = useState(isNew);
  const [title, setTitle] = useState(product?.title ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [status, setStatus] = useState<ProductStatus>(product?.status ?? "draft");
  const [handle, setHandle] = useState(product?.handle ?? "");
  const [handleEdited, setHandleEdited] = useState(!isNew);
  const [images, setImages] = useState<string[]>(product?.images ?? []);
  const [options, setOptions] = useState<ProductOption[]>(product?.options ?? []);
  const [variants, setVariants] = useState<EditableVariant[]>(() => toEditable(product));
  const [selectedCollections, setSelectedCollections] = useState<string[]>(memberOf);
  const [seoOpen, setSeoOpen] = useState(false);
  const [seoTitle, setSeoTitle] = useState(product?.seo.title ?? "");
  const [seoDesc, setSeoDesc] = useState(product?.seo.description ?? "");

  const mark = () => setDirty(true);
  const statusPill = productStatusPill(status);
  const previewBase = `${storeDomain(storeSubdomain)}/products/`;
  const hasOptions = options.length > 0;

  function onTitle(v: string) {
    setTitle(v);
    if (!handleEdited) setHandle(slugify(v));
    mark();
  }
  function updateVariant(i: number, patch: Partial<EditableVariant>) {
    setVariants((vs) => vs.map((v, j) => (j === i ? { ...v, ...patch } : v)));
    mark();
  }

  /* ---- options builder ---- */
  function addOption() {
    if (options.length >= 3) {
      toast("Up to 3 options per product");
      return;
    }
    setOptions((os) => [...os, { name: "", values: [] }]);
    mark();
  }
  function setOption(i: number, patch: Partial<ProductOption>) {
    const next = options.map((o, j) => (j === i ? { ...o, ...patch } : o));
    setOptions(next);
    setVariants((vs) => regenerate(next, vs));
    mark();
  }
  function removeOption(i: number) {
    const next = options.filter((_, j) => j !== i);
    setOptions(next);
    setVariants((vs) => regenerate(next, vs));
    mark();
  }

  /* ---- collections membership ---- */
  const collectionsById = new Map(collections.map((c) => [c._id, c]));
  const unselected = collections.filter((c) => !selectedCollections.includes(c._id));
  function toggleCollection(id: string) {
    setSelectedCollections((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
    );
    mark();
  }

  /* ---- build + persist ---- */
  function buildInput(): ProductInput {
    const cleanOptions = options
      .map((o) => ({ name: o.name.trim(), values: o.values.map((v) => v.trim()).filter(Boolean) }))
      .filter((o) => o.name && o.values.length > 0);
    const builtVariants: Variant[] = variants.map((v) => ({
      id: v.id,
      title: v.title,
      sku: v.sku.trim(),
      ...(v.barcode.trim() ? { barcode: v.barcode.trim() } : {}),
      price: v.price,
      compareAtPrice: v.compareAt,
      inventory: {
        quantity: v.qty,
        policy: v.policy,
        lowStockThreshold: v.threshold,
        trackInventory: v.track,
      },
    }));
    return {
      title: title.trim(),
      description,
      images,
      status,
      handle: handle.trim(),
      seo: {
        ...(seoTitle.trim() ? { title: seoTitle.trim() } : {}),
        ...(seoDesc.trim() ? { description: seoDesc.trim() } : {}),
      },
      options: cleanOptions,
      variants: builtVariants,
    };
  }

  function save() {
    if (!title.trim()) {
      toast("Add a product title first", { tone: "critical" });
      return;
    }
    if (!handle.trim()) {
      toast("Add a handle first", { tone: "critical" });
      return;
    }
    startTransition(async () => {
      const res = await saveProduct(product?._id ?? null, buildInput(), selectedCollections);
      if (!res.ok) {
        toast(res.error ?? "Couldn't save", { tone: "critical" });
        return;
      }
      setDirty(false);
      toast(isNew ? "Product created" : "Product saved");
      // Land on the index after create (the new row appears there in both DB and
      // mock modes); stay on the editor after an update.
      if (isNew) router.push("/products");
      else router.refresh();
    });
  }
  function discard() {
    if (isNew) router.push("/products");
    else router.refresh();
    setDirty(false);
  }
  function duplicate(close: () => void) {
    if (!product) return;
    startTransition(async () => {
      const res = await duplicateProductAction(product._id);
      close();
      if (!res.ok || !res.id) {
        toast(res.error ?? "Couldn't duplicate", { tone: "critical" });
        return;
      }
      toast("Product duplicated");
      router.push("/products");
    });
  }
  function destroy(close?: () => void) {
    if (!product) return;
    startTransition(async () => {
      await removeProduct(product._id);
      close?.();
      toast("Product deleted");
      router.push("/products");
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
            onClick={() => router.push("/products")}
          >
            <Icon name="chevronLeft" size={15} aria-hidden /> Products
          </button>
        }
        title={isNew ? "New product" : title || "Untitled product"}
        pill={<Pill tone={statusPill.tone}>{statusPill.label}</Pill>}
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
                    <MenuItem icon="copy" onClick={() => duplicate(close)}>
                      Duplicate
                    </MenuItem>
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
                      Delete product
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
          gridTemplateColumns: "1.9fr 1fr",
          gap: "var(--space-5)",
          alignItems: "start",
        }}
      >
        {/* MAIN COLUMN */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
          <Card>
            <Field label="Title">
              {(p) => (
                <Input
                  {...p}
                  value={title}
                  onChange={(e) => onTitle(e.target.value)}
                  placeholder="e.g. Blue Dream · 1g"
                />
              )}
            </Field>
            <div style={{ height: "var(--space-4)" }} />
            <Field
              label="Description"
              help="Minimal formatting — bold, italic, links, headings, lists."
            >
              <RichTextInput
                value={description}
                onValueChange={(v) => {
                  setDescription(v);
                  mark();
                }}
                placeholder="Describe this product…"
              />
            </Field>
          </Card>

          <Card>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                marginBottom: "var(--space-3)",
              }}
            >
              <h3
                style={{
                  fontSize: "var(--text-base)",
                  fontWeight: 600,
                  color: "var(--text-strong)",
                }}
              >
                Media
              </h3>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                4:5 portrait recommended
              </span>
            </div>
            <ImageDropzone
              images={images}
              onChange={(next) => {
                setImages(next);
                mark();
              }}
            />
          </Card>

          {!hasOptions && (
            <Card>
              <h3
                style={{
                  fontSize: "var(--text-base)",
                  fontWeight: 600,
                  color: "var(--text-strong)",
                  marginBottom: "var(--space-3)",
                }}
              >
                Pricing
              </h3>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "var(--space-4)",
                }}
              >
                <Field label="Price">
                  <PriceInput
                    value={variants[0]?.price ?? 0}
                    onChange={(e) => updateVariant(0, { price: Number(e.target.value) || 0 })}
                  />
                </Field>
                <Field label="Compare-at price" help="Shown struck-through">
                  <PriceInput
                    value={variants[0]?.compareAt ?? ""}
                    onChange={(e) =>
                      updateVariant(0, {
                        compareAt: e.target.value === "" ? null : Number(e.target.value) || 0,
                      })
                    }
                  />
                </Field>
              </div>
            </Card>
          )}

          <Card
            title="Variants"
            pad={false}
            action={
              <Button size="sm" variant="default" icon="plus" onClick={addOption}>
                Add option
              </Button>
            }
          >
            {options.length > 0 && (
              <div
                style={{
                  padding: "var(--space-4) var(--space-6)",
                  borderBottom: "1px solid var(--border)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-3)",
                }}
              >
                {options.map((o, i) => (
                  <div
                    key={i}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "140px 1fr 32px",
                      gap: "var(--space-3)",
                      alignItems: "end",
                    }}
                  >
                    <Field label={i === 0 ? "Option name" : ""}>
                      <Input
                        value={o.name}
                        onChange={(e) => setOption(i, { name: e.target.value })}
                        placeholder="Size"
                        style={{ height: 34 }}
                        aria-label={`Option ${i + 1} name`}
                      />
                    </Field>
                    <Field
                      label={i === 0 ? "Values" : ""}
                      help={i === options.length - 1 ? "Comma-separated, e.g. 1g, 3.5g, 7g" : undefined}
                    >
                      <Input
                        value={o.values.join(", ")}
                        onChange={(e) =>
                          setOption(i, {
                            values: e.target.value.split(",").map((v) => v.trimStart()),
                          })
                        }
                        placeholder="1g, 3.5g, 7g"
                        style={{ height: 34 }}
                        aria-label={`Option ${i + 1} values`}
                      />
                    </Field>
                    <IconButton
                      name="trash"
                      size={32}
                      aria-label={`Remove option ${i + 1}`}
                      onClick={() => removeOption(i)}
                    />
                  </div>
                ))}
              </div>
            )}
            <div style={{ overflowX: "auto" }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th scope="col">Variant</th>
                    <th scope="col">SKU</th>
                    <th scope="col">Barcode</th>
                    <th scope="col" className="col-right">
                      Price
                    </th>
                    <th scope="col" className="col-right">
                      Compare-at
                    </th>
                    <th scope="col" className="col-right">
                      Qty
                    </th>
                    <th scope="col" className="col-right">
                      Low at
                    </th>
                    <th scope="col">Track</th>
                    <th scope="col">When out</th>
                  </tr>
                </thead>
                <tbody>
                  {variants.map((v, i) => (
                    <tr key={v.id} style={{ cursor: "default" }}>
                      <td>
                        <span style={{ fontWeight: 500, color: "var(--text-strong)" }}>
                          {v.title}
                        </span>
                      </td>
                      <td>
                        <Input
                          mono
                          value={v.sku}
                          onChange={(e) => updateVariant(i, { sku: e.target.value })}
                          style={{ height: 30, width: 110, fontSize: "var(--text-sm)" }}
                          aria-label={`SKU for ${v.title}`}
                        />
                      </td>
                      <td>
                        <Input
                          mono
                          value={v.barcode}
                          onChange={(e) => updateVariant(i, { barcode: e.target.value })}
                          style={{ height: 30, width: 130, fontSize: "var(--text-sm)" }}
                          aria-label={`Barcode for ${v.title}`}
                        />
                      </td>
                      <td className="col-right">
                        <Input
                          mono
                          inputMode="decimal"
                          value={v.price}
                          onChange={(e) =>
                            updateVariant(i, { price: Number(e.target.value) || 0 })
                          }
                          style={{
                            height: 30,
                            width: 76,
                            fontSize: "var(--text-sm)",
                            textAlign: "right",
                          }}
                          aria-label={`Price for ${v.title}`}
                        />
                      </td>
                      <td className="col-right">
                        <Input
                          mono
                          inputMode="decimal"
                          value={v.compareAt ?? ""}
                          onChange={(e) =>
                            updateVariant(i, {
                              compareAt:
                                e.target.value === "" ? null : Number(e.target.value) || 0,
                            })
                          }
                          style={{
                            height: 30,
                            width: 76,
                            fontSize: "var(--text-sm)",
                            textAlign: "right",
                          }}
                          aria-label={`Compare-at price for ${v.title}`}
                        />
                      </td>
                      <td className="col-right">
                        <Input
                          mono
                          inputMode="numeric"
                          value={v.qty}
                          onChange={(e) =>
                            updateVariant(i, {
                              qty: parseInt(e.target.value || "0", 10) || 0,
                            })
                          }
                          style={{
                            height: 30,
                            width: 60,
                            fontSize: "var(--text-sm)",
                            textAlign: "right",
                          }}
                          aria-label={`Quantity for ${v.title}`}
                        />
                      </td>
                      <td className="col-right">
                        <Input
                          mono
                          inputMode="numeric"
                          value={v.threshold}
                          onChange={(e) =>
                            updateVariant(i, {
                              threshold: parseInt(e.target.value || "0", 10) || 0,
                            })
                          }
                          style={{
                            height: 30,
                            width: 56,
                            fontSize: "var(--text-sm)",
                            textAlign: "right",
                          }}
                          aria-label={`Low-stock threshold for ${v.title}`}
                        />
                      </td>
                      <td>
                        <Switch
                          checked={v.track}
                          onChange={(next) => updateVariant(i, { track: next })}
                          aria-label={`Track inventory for ${v.title}`}
                        />
                      </td>
                      <td>
                        <Select
                          value={v.policy}
                          onChange={(e) =>
                            updateVariant(i, { policy: e.target.value as InventoryPolicy })
                          }
                          options={[
                            { value: "deny", label: "Stop selling" },
                            { value: "continue", label: "Continue" },
                          ]}
                          style={{ height: 30, fontSize: "var(--text-sm)", width: 140 }}
                          aria-label={`Out-of-stock policy for ${v.title}`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* SIDE COLUMN */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
          <Card>
            <Field label="Status">
              <Select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as ProductStatus);
                  mark();
                }}
                options={[
                  { value: "active", label: "Active" },
                  { value: "draft", label: "Draft" },
                ]}
              />
            </Field>
          </Card>

          <Card>
            <Eyebrow>Organization</Eyebrow>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-4)",
                marginTop: "var(--space-3)",
              }}
            >
              <Field label="Collections">
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  {selectedCollections.map((id) => {
                    const c = collectionsById.get(id);
                    if (!c) return null;
                    return (
                      <span
                        key={id}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: "var(--text-xs)",
                          padding: "4px 8px",
                          borderRadius: 999,
                          background: "var(--surface-sunken)",
                          color: "var(--text-strong)",
                        }}
                      >
                        {c.title}
                        <button
                          type="button"
                          aria-label={`Remove from ${c.title}`}
                          onClick={() => toggleCollection(id)}
                          style={{
                            display: "inline-flex",
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            padding: 0,
                            color: "var(--text-muted)",
                          }}
                        >
                          <Icon name="x" size={12} aria-hidden />
                        </button>
                      </span>
                    );
                  })}
                  {unselected.length > 0 ? (
                    <Dropdown
                      trigger={
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          style={{ color: "var(--accent-pressed)" }}
                        >
                          <Icon name="plus" size={13} aria-hidden /> Add
                        </button>
                      }
                    >
                      {(close) => (
                        <>
                          {unselected.map((c) => (
                            <MenuItem
                              key={c._id}
                              onClick={() => {
                                toggleCollection(c._id);
                                close();
                              }}
                            >
                              {c.title}
                            </MenuItem>
                          ))}
                        </>
                      )}
                    </Dropdown>
                  ) : (
                    collections.length === 0 && (
                      <span
                        style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}
                      >
                        No collections yet
                      </span>
                    )
                  )}
                </div>
              </Field>
            </div>
          </Card>

          <Card>
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
            </Field>
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
          </Card>

          <Card pad={false}>
            <button
              type="button"
              onClick={() => setSeoOpen((o) => !o)}
              aria-expanded={seoOpen}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                padding: "var(--space-4) var(--space-6)",
                background: "transparent",
                border: "none",
                cursor: "pointer",
              }}
            >
              <span
                style={{
                  fontSize: "var(--text-base)",
                  fontWeight: 600,
                  color: "var(--text-strong)",
                }}
              >
                SEO override
              </span>
              <Icon
                name={seoOpen ? "chevronUp" : "chevronDown"}
                size={16}
                style={{ color: "var(--text-muted)" }}
                aria-hidden
              />
            </button>
            {seoOpen && (
              <div
                style={{
                  padding: "0 var(--space-6) var(--space-6)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-4)",
                }}
              >
                <Field label="Meta title">
                  <Input
                    value={seoTitle}
                    onChange={(e) => {
                      setSeoTitle(e.target.value);
                      mark();
                    }}
                    placeholder={title ? `${title} — Store` : "Page title"}
                  />
                </Field>
                <Field label="Meta description">
                  <Input
                    value={seoDesc}
                    onChange={(e) => {
                      setSeoDesc(e.target.value);
                      mark();
                    }}
                    placeholder="A short search snippet…"
                  />
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
                    {seoTitle || title || "Product title"}
                  </div>
                  <div
                    className="mono"
                    style={{ color: "var(--success)", fontSize: "var(--text-xs)" }}
                  >
                    {previewBase}
                    {handle || "handle"}
                  </div>
                  <div style={{ color: "var(--text-muted)", fontSize: "var(--text-xs)" }}>
                    {seoDesc || "Add a meta description to control the search snippet."}
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Sticky save bar (dirty state) */}
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
            {isNew ? "New product — not saved yet" : "Unsaved changes"}
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
