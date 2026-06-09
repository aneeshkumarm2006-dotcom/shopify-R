"use client";

import type { Product, Section, SectionSettings } from "@/types";
import {
  Button,
  Dropdown,
  Field,
  Icon,
  IconButton,
  ImageDropzone,
  Input,
  MenuItem,
  Textarea,
  Thumb,
} from "@/components/ui";
import { SECTION_META } from "./section-catalog";
import { RepeatableList, ToggleRow } from "./controls";

/**
 * Builder settings panel (right column · DESIGN §4.9). The fields shown vary by the
 * selected section's type — each form reads and writes that section's `settings` bag
 * (and array-valued "blocks": nav links, gallery images, collection tiles, footer
 * columns). Every change flows back through `onUpdate` into the local `themeConfig`,
 * which the center `StoreRenderer` preview re-reads live. `header`/`footer` are shared
 * regions and cannot be removed.
 */
export interface SectionSettingsPanelProps {
  section: Section | null;
  products: Product[];
  onUpdate: (patch: SectionSettings) => void;
  onRemove: () => void;
  removable: boolean;
}

export function SectionSettingsPanel({
  section,
  products,
  onUpdate,
  onRemove,
  removable,
}: SectionSettingsPanelProps) {
  if (!section) {
    return (
      <div className="bld-settings-empty">
        <Icon name="sliders" size={24} aria-hidden />
        <p>Select a section to edit its content</p>
      </div>
    );
  }

  const meta = SECTION_META[section.type];
  const s = section.settings as Record<string, unknown>;
  const set = (key: string, value: unknown) => onUpdate({ ...s, [key]: value });

  return (
    <div className="bld-settings">
      <header className="bld-settings-head">
        <Icon name={meta.icon} size={16} aria-hidden />
        <span>{meta.label}</span>
      </header>

      <div className="bld-settings-body">{renderFields(section, s, set, products)}</div>

      {removable && (
        <footer className="bld-settings-foot">
          <Button variant="critical" size="sm" block icon="trash" onClick={onRemove}>
            Remove section
          </Button>
        </footer>
      )}
    </div>
  );
}

/* ============================================================ per-type forms */

function renderFields(
  section: Section,
  s: Record<string, unknown>,
  set: (key: string, value: unknown) => void,
  products: Product[],
) {
  const str = (k: string) => (s[k] as string) ?? "";

  switch (section.type) {
    /* ---------------------------------------------------------------- hero */
    case "hero":
      return (
        <>
          <Field label="Heading">
            {(p) => (
              <Textarea
                {...p}
                value={str("heading")}
                onChange={(e) => set("heading", e.target.value)}
                style={{ minHeight: 64 }}
              />
            )}
          </Field>
          <Field label="Subtext">
            {(p) => (
              <Textarea
                {...p}
                value={str("subtext")}
                onChange={(e) => set("subtext", e.target.value)}
              />
            )}
          </Field>
          <Field label="Button label">
            {(p) => (
              <Input {...p} value={str("cta")} onChange={(e) => set("cta", e.target.value)} />
            )}
          </Field>
          <Field label="Button link" help="Where the button points, e.g. /collections/flower">
            {(p) => (
              <Input
                {...p}
                value={str("ctaHref")}
                onChange={(e) => set("ctaHref", e.target.value)}
              />
            )}
          </Field>
          <SingleImage label="Background image" value={str("image")} onChange={(v) => set("image", v)} />
          <ToggleRow
            label="Height"
            options={[
              { value: "short", label: "Standard" },
              { value: "tall", label: "Tall" },
            ]}
            value={str("height") || "short"}
            onChange={(v) => set("height", v)}
          />
          <ToggleRow
            label="Alignment"
            options={[
              { value: "left", label: "Left" },
              { value: "center", label: "Center" },
            ]}
            value={str("align") || "left"}
            onChange={(v) => set("align", v)}
          />
        </>
      );

    /* ----------------------------------------------------- featured_products */
    case "featured_products":
      return (
        <>
          <Field label="Title">
            {(p) => (
              <Input {...p} value={str("title")} onChange={(e) => set("title", e.target.value)} />
            )}
          </Field>
          <ProductPicker
            ids={(s.productIds as string[]) ?? []}
            products={products}
            onChange={(ids) => set("productIds", ids)}
          />
          <ColumnsToggle value={(s.columns as number) ?? 4} onChange={(c) => set("columns", c)} />
        </>
      );

    /* ------------------------------------------------------- collection_list */
    case "collection_list":
      return (
        <>
          <Field label="Title">
            {(p) => (
              <Input {...p} value={str("title")} onChange={(e) => set("title", e.target.value)} />
            )}
          </Field>
          <RepeatableList<{ name: string; handle?: string; count?: number }>
            label="Collections"
            addLabel="Add collection"
            items={(s.collections as { name: string; handle?: string; count?: number }[]) ?? []}
            onChange={(next) => set("collections", next)}
            newItem={() => ({ name: "New collection", handle: "", count: 0 })}
            emptyHint="No collections yet."
            renderItem={(item, update) => (
              <>
                <Input
                  aria-label="Collection name"
                  placeholder="Name"
                  value={item.name}
                  onChange={(e) => update({ name: e.target.value })}
                />
                <Input
                  aria-label="Collection handle"
                  placeholder="handle"
                  value={item.handle ?? ""}
                  onChange={(e) => update({ handle: e.target.value })}
                />
              </>
            )}
          />
          <ColumnsToggle value={(s.columns as number) ?? 4} onChange={(c) => set("columns", c)} />
        </>
      );

    /* ------------------------------------------------------------- rich_text */
    case "rich_text":
      return (
        <>
          <Field label="Heading">
            {(p) => (
              <Input
                {...p}
                value={str("heading")}
                onChange={(e) => set("heading", e.target.value)}
              />
            )}
          </Field>
          <Field label="Body">
            {(p) => (
              <Textarea
                {...p}
                value={str("body")}
                onChange={(e) => set("body", e.target.value)}
                style={{ minHeight: 110 }}
              />
            )}
          </Field>
          <ToggleRow
            label="Alignment"
            options={[
              { value: "left", label: "Left" },
              { value: "center", label: "Center" },
            ]}
            value={str("align") || "center"}
            onChange={(v) => set("align", v)}
          />
        </>
      );

    /* ------------------------------------------------------ image_with_text */
    case "image_with_text":
      return (
        <>
          <Field label="Heading">
            {(p) => (
              <Input
                {...p}
                value={str("heading")}
                onChange={(e) => set("heading", e.target.value)}
              />
            )}
          </Field>
          <Field label="Body">
            {(p) => (
              <Textarea
                {...p}
                value={str("body")}
                onChange={(e) => set("body", e.target.value)}
                style={{ minHeight: 100 }}
              />
            )}
          </Field>
          <Field label="Button label">
            {(p) => (
              <Input {...p} value={str("cta")} onChange={(e) => set("cta", e.target.value)} />
            )}
          </Field>
          <Field label="Button link">
            {(p) => (
              <Input
                {...p}
                value={str("ctaHref")}
                onChange={(e) => set("ctaHref", e.target.value)}
              />
            )}
          </Field>
          <SingleImage label="Image" value={str("image")} onChange={(v) => set("image", v)} />
          <ToggleRow
            label="Image side"
            options={[
              { value: "left", label: "Left" },
              { value: "right", label: "Right" },
            ]}
            value={str("side") || "left"}
            onChange={(v) => set("side", v)}
          />
        </>
      );

    /* --------------------------------------------------------------- gallery */
    case "gallery":
      return (
        <>
          <Field label="Images" help="Drag to upload; the grid fills left-to-right.">
            <ImageDropzone
              images={(s.images as string[]) ?? []}
              onChange={(next) => set("images", next)}
              hint="Add gallery images"
            />
          </Field>
          <ColumnsToggle
            value={(s.columns as number) ?? 3}
            onChange={(c) => set("columns", c)}
            options={[2, 3, 4]}
          />
        </>
      );

    /* ----------------------------------------------------- newsletter_static */
    case "newsletter_static":
      return (
        <>
          <Field label="Heading">
            {(p) => (
              <Input
                {...p}
                value={str("heading")}
                onChange={(e) => set("heading", e.target.value)}
              />
            )}
          </Field>
          <Field label="Subtext">
            {(p) => (
              <Textarea
                {...p}
                value={str("subtext")}
                onChange={(e) => set("subtext", e.target.value)}
              />
            )}
          </Field>
          <Field label="Input placeholder">
            {(p) => (
              <Input
                {...p}
                value={str("placeholder")}
                onChange={(e) => set("placeholder", e.target.value)}
              />
            )}
          </Field>
          <Field label="Button label">
            {(p) => (
              <Input
                {...p}
                value={str("button")}
                onChange={(e) => set("button", e.target.value)}
              />
            )}
          </Field>
        </>
      );

    /* ----------------------------------------------------------- custom_html */
    case "custom_html":
      return (
        <Field
          label="HTML"
          help="Raw HTML renders on the storefront. Sanitized at publish time (Stage 11)."
        >
          {(p) => (
            <Textarea
              {...p}
              mono
              value={str("html")}
              onChange={(e) => set("html", e.target.value)}
              placeholder="<div>…</div>"
              style={{ minHeight: 160 }}
            />
          )}
        </Field>
      );

    /* ---------------------------------------------------------------- header */
    case "header":
      return (
        <>
          <Field label="Promo bar text" help="Leave empty to hide the announcement bar.">
            {(p) => (
              <Input
                {...p}
                value={str("promo")}
                onChange={(e) => set("promo", e.target.value)}
              />
            )}
          </Field>
          <RepeatableList<{ label: string; href?: string }>
            label="Navigation links"
            addLabel="Add link"
            items={(s.nav as { label: string; href?: string }[]) ?? []}
            onChange={(next) => set("nav", next)}
            newItem={() => ({ label: "New link", href: "/" })}
            emptyHint="No navigation links."
            renderItem={(item, update) => (
              <>
                <Input
                  aria-label="Link label"
                  placeholder="Label"
                  value={item.label}
                  onChange={(e) => update({ label: e.target.value })}
                />
                <Input
                  aria-label="Link URL"
                  placeholder="/collections/…"
                  value={item.href ?? ""}
                  onChange={(e) => update({ href: e.target.value })}
                />
              </>
            )}
          />
        </>
      );

    /* ---------------------------------------------------------------- footer */
    case "footer":
      return (
        <>
          <Field label="Tagline">
            {(p) => (
              <Textarea
                {...p}
                value={str("tagline")}
                onChange={(e) => set("tagline", e.target.value)}
              />
            )}
          </Field>
          <RepeatableList<{ title: string; links: { label: string; href?: string }[] }>
            label="Link columns"
            addLabel="Add column"
            max={4}
            items={
              (s.columns as { title: string; links: { label: string; href?: string }[] }[]) ?? []
            }
            onChange={(next) => set("columns", next)}
            newItem={() => ({ title: "New column", links: [] })}
            emptyHint="No footer columns."
            renderItem={(item, update) => (
              <Input
                aria-label="Column title"
                placeholder="Column title"
                value={item.title}
                onChange={(e) => update({ title: e.target.value })}
              />
            )}
          />
          <Field label="Legal / compliance text">
            {(p) => (
              <Textarea
                {...p}
                value={str("legal")}
                onChange={(e) => set("legal", e.target.value)}
              />
            )}
          </Field>
        </>
      );

    default:
      return null;
  }
}

/* ============================================================ sub-controls */

function ColumnsToggle({
  value,
  onChange,
  options = [2, 3, 4],
}: {
  value: number;
  onChange: (n: number) => void;
  options?: number[];
}) {
  return (
    <ToggleRow
      label="Columns"
      options={options.map((n) => ({ value: String(n), label: String(n) }))}
      value={String(value)}
      onChange={(v) => onChange(parseInt(v, 10))}
    />
  );
}

/** Wraps the multi-image `ImageDropzone` down to a single slot for one-image settings. */
function SingleImage({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <ImageDropzone
        images={value ? [value] : []}
        onChange={(next) => onChange(next[next.length - 1] ?? "")}
        hint="Add an image"
      />
    </Field>
  );
}

/* ------------------------------------------------------------ product picker */
function ProductPicker({
  ids,
  products,
  onChange,
}: {
  ids: string[];
  products: Product[];
  onChange: (ids: string[]) => void;
}) {
  const byId = new Map(products.map((p) => [p._id, p]));
  const chosen = ids.map((id) => byId.get(id)).filter((p): p is Product => Boolean(p));
  const available = products.filter((p) => !ids.includes(p._id));

  return (
    <div className="field">
      <label className="field-label">Products</label>
      <div className="bld-list">
        {chosen.length === 0 && <p className="bld-list-empty">No products selected.</p>}
        {chosen.map((p, i) => (
          <div
            key={p._id}
            className="bld-list-row"
            draggable
            onDragStart={(e) => e.dataTransfer.setData("text/plain", String(i))}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const from = Number(e.dataTransfer.getData("text/plain"));
              if (Number.isNaN(from)) return;
              const next = ids.slice();
              const [m] = next.splice(from, 1);
              if (m === undefined) return;
              next.splice(i, 0, m);
              onChange(next);
            }}
          >
            <span className="bld-drag" aria-hidden>
              <Icon name="drag" size={14} />
            </span>
            <Thumb src={p.images[0] ?? null} alt="" size={28} />
            <span className="bld-product-title">{p.title}</span>
            <IconButton
              name="x"
              size={28}
              aria-label={`Remove ${p.title}`}
              onClick={() => onChange(ids.filter((x) => x !== p._id))}
            />
          </div>
        ))}
        <Dropdown
          align="left"
          width={240}
          trigger={
            <Button
              variant="default"
              size="sm"
              icon="plus"
              disabled={available.length === 0}
              className="bld-add-item"
            >
              Add product
            </Button>
          }
        >
          {(close) =>
            available.map((p) => (
              <MenuItem
                key={p._id}
                onClick={() => {
                  onChange([...ids, p._id]);
                  close();
                }}
              >
                {p.title}
              </MenuItem>
            ))
          }
        </Dropdown>
      </div>
    </div>
  );
}
