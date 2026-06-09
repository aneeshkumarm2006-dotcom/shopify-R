"use client";

import { useState, type ReactNode } from "react";
import type { Customer, Order, Product } from "@/types";
import { useTheme } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  Avatar,
  Button,
  Card,
  CartSheet,
  type CartLine,
  type Column,
  type Command,
  CommandPaletteProvider,
  DataTable,
  Divider,
  Dropdown,
  EmptyState,
  ErrorState,
  Eyebrow,
  Field,
  HandleInput,
  Icon,
  IconButton,
  ImageDropzone,
  Input,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  Modal,
  NoResultsState,
  PageHeader,
  Pill,
  PriceInput,
  RichTextInput,
  Select,
  Sheet,
  Skeleton,
  SkeletonRows,
  Stepper,
  Switch,
  Tabs,
  Textarea,
  Thumb,
  ToastProvider,
  Tooltip,
  ViewTabs,
  useCommandPalette,
  useToast,
} from "@/components/ui";

/* ============================================================
   Layout helpers
   ============================================================ */
function Section({
  id,
  title,
  hint,
  children,
}: {
  id: string;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} style={{ marginBottom: "var(--space-12)", scrollMarginTop: 80 }}>
      <div style={{ marginBottom: "var(--space-4)" }}>
        <h2
          style={{
            fontSize: "var(--text-lg)",
            fontWeight: 600,
            color: "var(--text-strong)",
          }}
        >
          {title}
        </h2>
        {hint && (
          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", marginTop: 4 }}>
            {hint}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

function Row({ children, align = "center" }: { children: ReactNode; align?: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "var(--space-3)",
        alignItems: align,
      }}
    >
      {children}
    </div>
  );
}

function Stack({ children, gap = 16 }: { children: ReactNode; gap?: number }) {
  return <div style={{ display: "flex", flexDirection: "column", gap }}>{children}</div>;
}

function Label({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginBottom: 8 }}>
      {children}
    </div>
  );
}

/* ============================================================
   Demo data shaping
   ============================================================ */
type DemoRow = { id: string; title: string; status: Product["status"]; qty: number; price: number; image?: string | null };

function toRows(products: Product[]): DemoRow[] {
  return products.slice(0, 6).map((p) => ({
    id: p._id,
    title: p.title,
    status: p.status,
    qty: p.variants.reduce((s, v) => s + v.inventory.quantity, 0),
    price: p.variants[0]?.price ?? 0,
    image: p.images[0] ?? null,
  }));
}

function inventoryPill(qty: number) {
  if (qty <= 0) return <Pill tone="critical">Out</Pill>;
  if (qty < 10) return <Pill tone="warning">{qty} low</Pill>;
  return <Pill tone="success">{qty} in stock</Pill>;
}

function money(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/* ============================================================
   The gallery (everything that is NOT a body-portal overlay)
   Rendered both under the global theme and in the side-by-side
   light/dark islands, so contrast is visible in both at once.
   ============================================================ */
function Showcase({ rows }: { rows: DemoRow[] }) {
  const [tab, setTab] = useState("all");
  const [view, setView] = useState("all");
  const [sw1, setSw1] = useState(true);
  const [sw2, setSw2] = useState(false);
  const [qty, setQty] = useState(3);
  const [selected, setSelected] = useState<string[]>([rows[1]?.id].filter(Boolean) as string[]);
  const [price, setPrice] = useState("24.00");
  const [handle, setHandle] = useState("blue-dream-1g");
  const [rich, setRich] = useState("Top-shelf indica with **earthy** notes.\n\n## Effects\n- Calm\n- Focused");
  const [images, setImages] = useState<string[]>([]);

  const columns: Column<DemoRow>[] = [
    {
      key: "title",
      header: "Product",
      render: (r) => (
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <Thumb src={r.image} ratio="4 / 5" size={36} />
          <span style={{ fontWeight: 500, color: "var(--text-strong)" }}>{r.title}</span>
        </div>
      ),
    },
    { key: "status", header: "Status", render: (r) => <Pill tone={r.status === "active" ? "success" : "muted"}>{r.status === "active" ? "Active" : "Draft"}</Pill> },
    { key: "inv", header: "Inventory", render: (r) => inventoryPill(r.qty) },
    { key: "price", header: "Price", numeric: true, render: (r) => money(r.price) },
    {
      key: "actions",
      header: "",
      width: 48,
      render: (r) => (
        <span onClick={(e) => e.stopPropagation()} style={{ display: "inline-flex" }}>
          <Dropdown
            align="right"
            trigger={<IconButton name="dots" size={28} aria-label={`Actions for ${r.title}`} />}
          >
            {(close) => (
              <>
                <MenuItem icon="eye" onClick={close}>View</MenuItem>
                <MenuItem icon="copy" onClick={close}>Duplicate</MenuItem>
                <MenuSeparator />
                <MenuItem icon="trash" danger onClick={close}>Delete</MenuItem>
              </>
            )}
          </Dropdown>
        </span>
      ),
    },
  ];

  return (
    <Stack gap={40}>
      {/* Buttons */}
      <div>
        <Label>Buttons — variants · sizes · modifiers · states</Label>
        <Stack gap={12}>
          <Row>
            <Button variant="primary" icon="plus">Add product</Button>
            <Button variant="default">Default</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="critical" icon="trash">Delete</Button>
            <Button variant="critical-solid">Confirm delete</Button>
          </Row>
          <Row>
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
            <Button variant="primary" pill>Pill CTA</Button>
            <Button loading>Saving…</Button>
            <Button disabled>Disabled</Button>
            <Button variant="primary" iconRight="arrowRight">Continue</Button>
          </Row>
          <div style={{ maxWidth: 280 }}>
            <Button variant="primary" block icon="store">Block button</Button>
          </div>
        </Stack>
      </div>

      {/* Icon buttons */}
      <div>
        <Label>Icon buttons — 28 / 32 / 36 · tooltip · disabled</Label>
        <Row>
          <IconButton name="search" size={28} aria-label="Search" />
          <IconButton name="settings" size={32} aria-label="Settings" />
          <IconButton name="bell" size={36} aria-label="Notifications" />
          <Tooltip tip="Duplicate">
            <IconButton name="copy" size={32} aria-label="Duplicate" />
          </Tooltip>
          <IconButton name="trash" size={32} aria-label="Delete" disabled />
        </Row>
      </div>

      {/* Inputs / fields */}
      <div>
        <Label>Inputs & fields — label · help · error · specialized</Label>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "var(--space-5)",
          }}
        >
          <Field label="Store name" help="Shown in the browser tab.">
            {(p) => <Input placeholder="Northbound" defaultValue="Northbound" {...p} />}
          </Field>
          <Field label="Status">
            {(p) => <Select options={["Active", "Draft"]} {...p} />}
          </Field>
          <Field label="Email" error="Enter a valid email address." required>
            {(p) => <Input type="email" defaultValue="not-an-email" {...p} />}
          </Field>
          <Field label="Price">
            {(p) => <PriceInput value={price} onChange={(e) => setPrice(e.target.value)} {...p} />}
          </Field>
          <Field label="SKU (mono)">
            {(p) => <Input mono defaultValue="BD-1G-001" {...p} />}
          </Field>
          <Field label="Handle" help="DNS-safe slug.">
            {(p) => (
              <HandleInput
                base="northbound.offshelf.app/products/"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                {...p}
              />
            )}
          </Field>
          <div style={{ gridColumn: "1 / -1" }}>
            <Field label="Notes (textarea)">
              {(p) => <Textarea placeholder="Internal notes…" rows={3} {...p} />}
            </Field>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <Field label="Large input (storefront)">
              {(p) => <Input large placeholder="you@example.com" {...p} />}
            </Field>
          </div>
        </div>
      </div>

      {/* Rich text + dropzone */}
      <div>
        <Label>Rich-text input (B/I/link/H2/H3/UL/OL) · image dropzone</Label>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "var(--space-5)",
          }}
        >
          <Field label="Description">
            {() => <RichTextInput value={rich} onValueChange={setRich} />}
          </Field>
          <Field label="Product images">
            {() => <ImageDropzone images={images} onChange={setImages} />}
          </Field>
        </div>
      </div>

      {/* Pills */}
      <div>
        <Label>Status pills — functional colors only (never lime)</Label>
        <Stack gap={10}>
          <Row>
            <Pill tone="success">Success</Pill>
            <Pill tone="warning">Warning</Pill>
            <Pill tone="critical">Critical</Pill>
            <Pill tone="info">Info</Pill>
            <Pill tone="muted">Muted</Pill>
            <Pill tone="muted" dot={false}>No dot</Pill>
          </Row>
          <Row>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>Payment:</span>
            <Pill tone="warning">Pending</Pill>
            <Pill tone="success">Paid</Pill>
            <Pill tone="muted">Refunded</Pill>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginLeft: 12 }}>Fulfillment:</span>
            <Pill tone="muted">Unfulfilled</Pill>
            <Pill tone="success">Fulfilled</Pill>
            <Pill tone="critical">Cancelled</Pill>
          </Row>
        </Stack>
      </div>

      {/* Tabs */}
      <div>
        <Label>Tabs (underline) · view-tabs (filter chips with counts)</Label>
        <Stack gap={16}>
          <Tabs
            aria-label="Product status"
            active={tab}
            onChange={setTab}
            tabs={[
              { value: "all", label: "All", count: 24 },
              { value: "active", label: "Active", count: 18 },
              { value: "draft", label: "Draft", count: 6 },
            ]}
          />
          <ViewTabs
            aria-label="Saved views"
            active={view}
            onChange={setView}
            tabs={[
              { value: "all", label: "All orders", count: 132 },
              { value: "unfulfilled", label: "Unfulfilled", count: 7 },
              { value: "unpaid", label: "Unpaid", count: 3 },
            ]}
          />
        </Stack>
      </div>

      {/* Switch / stepper / avatar / thumb / eyebrow / divider */}
      <div>
        <Label>Switch · stepper · avatar · thumb · eyebrow · divider</Label>
        <Row align="center">
          <Switch checked={sw1} onChange={setSw1} aria-label="Track inventory" />
          <Switch checked={sw2} onChange={setSw2} aria-label="Age gate" />
          <Switch checked={false} onChange={() => {}} disabled aria-label="Disabled" />
          <Stepper value={qty} onChange={setQty} min={0} max={99} />
          <Avatar name="Dana Reyes" size={36} />
          <Avatar name="Kai Lin" size={28} />
          <Thumb src={rows[0]?.image} ratio="4 / 5" size={44} />
          <Thumb size={44} ratio="4 / 5" />
          <Eyebrow>New arrivals</Eyebrow>
        </Row>
        <Divider style={{ margin: "var(--space-4) 0" }} />
      </div>

      {/* Dropdown / menu inline */}
      <div>
        <Label>Dropdown / menu — items · labels · separators · danger</Label>
        <Dropdown
          align="left"
          trigger={<Button variant="default" iconRight="chevronDown">Actions</Button>}
        >
          {(close) => (
            <>
              <MenuLabel>Manage</MenuLabel>
              <MenuItem icon="eye" hint="↵" onClick={close}>View store</MenuItem>
              <MenuItem icon="copy" onClick={close}>Duplicate</MenuItem>
              <MenuItem icon="download" onClick={close}>Export CSV</MenuItem>
              <MenuSeparator />
              <MenuItem icon="trash" danger onClick={close}>Delete store</MenuItem>
            </>
          )}
        </Dropdown>
      </div>

      {/* Card + data table */}
      <div>
        <Label>Card + data table — sticky header · select-all · bulk bar · row menu</Label>
        <Card
          title="Products"
          action={<Button size="sm" variant="primary" icon="plus">Add product</Button>}
          pad={false}
        >
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            onRowClick={() => {}}
            selectable
            selectedIds={selected}
            onSelectionChange={setSelected}
            bulkActions={
              <>
                <Button size="sm" variant="default">Set active</Button>
                <Button size="sm" variant="default">Set draft</Button>
                <Button size="sm" variant="critical">Delete</Button>
              </>
            }
            pagination={
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <IconButton name="chevronLeft" size={28} aria-label="Previous page" />
                <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>1 / 4</span>
                <IconButton name="chevronRight" size={28} aria-label="Next page" />
              </div>
            }
          />
        </Card>
      </div>

      {/* Table states */}
      <div>
        <Label>Table states — loading skeleton · empty · zero-filtered</Label>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "var(--space-4)",
          }}
        >
          <Card pad={false}>
            <SkeletonRows rows={4} cols={4} />
          </Card>
          <Card pad={false}>
            <EmptyState
              icon="products"
              title="No products yet"
              body="Add your first product to start selling."
              action={<Button size="sm" variant="primary" icon="plus">Add product</Button>}
            />
          </Card>
          <Card pad={false}>
            <NoResultsState onClear={() => {}} />
          </Card>
        </div>
      </div>

      {/* States: error + skeleton bits */}
      <div>
        <Label>Error state · skeleton primitives</Label>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "var(--space-4)",
          }}
        >
          <Card pad={false}>
            <ErrorState onRetry={() => {}} />
          </Card>
          <Card>
            <Stack gap={10}>
              <Skeleton width="60%" height={18} />
              <Skeleton width="90%" />
              <Skeleton width="80%" />
              <Skeleton width={120} height={36} radius="var(--radius-md)" />
            </Stack>
          </Card>
        </div>
      </div>

      {/* Page header */}
      <div>
        <Label>Page-header pattern — breadcrumb · title · pill · actions · divider</Label>
        <Card>
          <PageHeader
            breadcrumb={
              <>
                <a href="#" style={{ color: "var(--text-muted)" }}>Products</a>
                <Icon name="chevronRight" size={13} aria-hidden />
                <span>Blue Dream 1g</span>
              </>
            }
            title="Blue Dream 1g"
            pill={<Pill tone="success">Active</Pill>}
            meta="Last updated 2 hours ago"
            actions={
              <>
                <Button variant="default">Preview</Button>
                <Button variant="primary">Save</Button>
                <Dropdown trigger={<IconButton name="dots" size={36} aria-label="More actions" />}>
                  {(close) => (
                    <>
                      <MenuItem icon="copy" onClick={close}>Duplicate</MenuItem>
                      <MenuItem icon="trash" danger onClick={close}>Delete</MenuItem>
                    </>
                  )}
                </Dropdown>
              </>
            }
          />
          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
            Page body content sits below the header divider.
          </p>
        </Card>
      </div>
    </Stack>
  );
}

/* ============================================================
   Overlay demos (body portals → follow the global theme)
   ============================================================ */
function OverlayDemos({ cartLines }: { cartLines: CartLine[] }) {
  const toast = useToast();
  const palette = useCommandPalette();
  const [modal, setModal] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [cart, setCart] = useState(false);
  const [cartEmpty, setCartEmpty] = useState(false);
  const [lines, setLines] = useState<CartLine[]>(cartLines);

  return (
    <>
      <Row>
        <Button variant="default" onClick={() => setModal(true)}>Open form modal</Button>
        <Button variant="critical" onClick={() => setConfirm(true)}>Destructive confirm</Button>
        <Button variant="default" onClick={() => setSheet(true)}>Open sheet</Button>
        <Button variant="default" icon="cart" onClick={() => { setCartEmpty(false); setCart(true); }}>
          Cart (filled)
        </Button>
        <Button variant="ghost" onClick={() => { setCartEmpty(true); setCart(true); }}>
          Cart (empty)
        </Button>
        <Button variant="default" icon="command" onClick={palette.open}>Command palette (⌘K)</Button>
      </Row>
      <Row>
        <Button variant="default" onClick={() => toast("Product saved")}>Toast: success</Button>
        <Button variant="default" onClick={() => toast("3 orders imported", { tone: "info" })}>
          Toast: info
        </Button>
        <Button variant="default" onClick={() => toast("Upload failed — retry", { tone: "critical" })}>
          Toast: critical
        </Button>
      </Row>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Edit store details"
        maxWidth={640}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => { setModal(false); toast("Saved"); }}>
              Save
            </Button>
          </>
        }
      >
        <Stack gap={16}>
          <Field label="Store name">{(p) => <Input defaultValue="Northbound" {...p} />}</Field>
          <Field label="Support email" help="Customers reply here.">
            {(p) => <Input type="email" defaultValue="hi@northbound.co" {...p} />}
          </Field>
        </Stack>
      </Modal>

      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Delete Blue Dream 1g?"
        maxWidth={480}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>Cancel</Button>
            <Button variant="critical-solid" onClick={() => { setConfirm(false); toast("Deleted", { tone: "critical" }); }}>
              Delete product
            </Button>
          </>
        }
      >
        <p style={{ fontSize: "var(--text-base)", color: "var(--text)", margin: 0 }}>
          This permanently removes the product and its variants. This can&apos;t be undone.
        </p>
      </Modal>

      <Sheet
        open={sheet}
        onClose={() => setSheet(false)}
        title="Filters"
        footer={
          <Button variant="primary" block onClick={() => setSheet(false)}>Apply</Button>
        }
      >
        <Stack gap={16}>
          <Field label="Status">{(p) => <Select options={["All", "Active", "Draft"]} {...p} />}</Field>
          <Field label="Stock">{(p) => <Select options={["Any", "Low", "Out"]} {...p} />}</Field>
        </Stack>
      </Sheet>

      <CartSheet
        open={cart}
        onClose={() => setCart(false)}
        items={cartEmpty ? [] : lines}
        onQuantityChange={(id, q) => setLines((ls) => ls.map((l) => (l.id === id ? { ...l, quantity: q } : l)))}
        onRemove={(id) => setLines((ls) => ls.filter((l) => l.id !== id))}
        onCheckout={() => { setCart(false); toast("Heading to checkout"); }}
        onContinue={() => setCart(false)}
      />
    </>
  );
}

/* ============================================================
   Root
   ============================================================ */
export interface KitchenSinkProps {
  products: Product[];
  orders: Order[];
  customers: Customer[];
}

export function KitchenSink({ products }: KitchenSinkProps) {
  const { theme } = useTheme();
  const rows = toRows(products);

  const cartLines: CartLine[] = rows.slice(0, 2).map((r) => ({
    id: r.id,
    title: r.title,
    variant: "1g · Indica",
    price: r.price,
    quantity: 1,
    image: r.image,
  }));

  const commands: Command[] = [
    { id: "home", group: "Navigate", label: "Go to Dashboard", icon: "home", hint: "G H", onRun: () => {} },
    { id: "orders", group: "Navigate", label: "Go to Orders", icon: "orders", onRun: () => {} },
    { id: "products", group: "Navigate", label: "Go to Products", icon: "products", onRun: () => {} },
    { id: "inventory", group: "Navigate", label: "Go to Inventory", icon: "inventory", onRun: () => {} },
    { id: "customers", group: "Navigate", label: "Go to Customers", icon: "customers", onRun: () => {} },
    { id: "add-product", group: "Actions", label: "Add product", icon: "plus", keywords: "new create", onRun: () => {} },
    { id: "publish", group: "Actions", label: "Publish store", icon: "store", onRun: () => {} },
    { id: "theme", group: "Actions", label: "Toggle theme", icon: "moon", onRun: () => {} },
  ];

  return (
    <ToastProvider>
      <CommandPaletteProvider commands={commands}>
        <main style={{ maxWidth: 1100, margin: "0 auto", padding: "var(--space-10) var(--space-6) var(--space-24)" }}>
        {/* Header */}
        <header
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "var(--space-4)",
            marginBottom: "var(--space-10)",
          }}
        >
          <div>
            <Eyebrow>Stage 1 · Design system</Eyebrow>
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "var(--text-3xl)",
                color: "var(--text-strong)",
                marginTop: 6,
              }}
            >
              Kitchen sink
            </h1>
            <p style={{ fontSize: "var(--text-base)", color: "var(--text-muted)", marginTop: 8, maxWidth: 560 }}>
              Every shared primitive in every state. Toggle the theme (or use the side-by-side
              comparison at the bottom) to verify AA contrast in light and dark. Press{" "}
              <span className="kbd">⌘</span> <span className="kbd">K</span> for the command palette.
            </p>
          </div>
          <div style={{ display: "flex", gap: "var(--space-2)", flexShrink: 0 }}>
            <ThemeToggle />
          </div>
        </header>

        <Section
          id="overlays"
          title="Overlays & feedback"
          hint="Modals, sheets, the cart sheet, toasts, and the ⌘K palette render to the page root and follow the global theme."
        >
          <OverlayDemos cartLines={cartLines} />
        </Section>

        <Section id="primitives" title="Primitives" hint={`Current theme: ${theme}. Interactive — hover, focus (Tab), and try the controls.`}>
          <Showcase rows={rows} />
        </Section>

        <Section
          id="both-themes"
          title="Light & dark, side by side"
          hint="The same gallery rendered in two forced-theme islands so contrast holds in both at once."
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
              gap: "var(--space-5)",
            }}
          >
            <div
              data-theme="light"
              style={{
                background: "var(--bg)",
                color: "var(--text)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                padding: "var(--space-5)",
              }}
            >
              <Eyebrow>Light</Eyebrow>
              <div style={{ marginTop: "var(--space-4)" }}>
                <Showcase rows={rows} />
              </div>
            </div>
            <div
              data-theme="dark"
              style={{
                background: "var(--bg)",
                color: "var(--text)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                padding: "var(--space-5)",
              }}
            >
              <Eyebrow>Dark</Eyebrow>
              <div style={{ marginTop: "var(--space-4)" }}>
                <Showcase rows={rows} />
              </div>
            </div>
          </div>
        </Section>
        </main>
      </CommandPaletteProvider>
    </ToastProvider>
  );
}
