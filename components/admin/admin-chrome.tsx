"use client";

import { useMemo, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { Customer, Order, Product, Store, Subscription, User } from "@/types";
import type { StoreCapStatus } from "@/lib/data/account";
import { useTheme } from "@/components/theme-provider";
import {
  Avatar,
  type Command,
  CommandPaletteProvider,
  Dropdown,
  Eyebrow,
  Icon,
  type IconName,
  IconButton,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  Pill,
  ToastProvider,
  useCommandPalette,
  useToast,
} from "@/components/ui";
import { storeStatusPill } from "@/components/admin/shared";
import { createStore, doSignOut, setActiveStore } from "@/lib/auth/actions";
import { storeDomain, storeOrigin } from "@/lib/format";

/**
 * Admin app shell (DESIGN §4.1) — 240px sidebar + 56px topbar + ⌘K palette, with
 * a ≤1200px centered content column. Wraps every dashboard screen; auth screens,
 * the kitchen sink, and the full-screen builder render bare (no chrome).
 *
 * The shell is a client component (active nav, theme toggle, palette, menus) but
 * its data is fetched server-side in the route-group layout and passed in, so the
 * Stage-0 stub seams stay the only data source.
 */

export interface AdminChromeProps {
  store: Store;
  owner: User;
  subscription: Subscription;
  /** Every store the signed-in user owns — populates the store switcher. */
  stores: Store[];
  /** Account plan + store-cap status — gates the switcher's "Create new store". */
  capStatus: StoreCapStatus;
  /** Slim records used to populate the ⌘K jump-to index. */
  products: Product[];
  orders: Order[];
  customers: Customer[];
  unfulfilledCount: number;
  lowCount: number;
  outCount: number;
  children: ReactNode;
}

interface NavItem {
  label: string;
  icon: IconName;
  href: string;
}

const NAV: NavItem[] = [
  { label: "Home", icon: "home", href: "/dashboard" },
  { label: "Orders", icon: "orders", href: "/orders" },
  { label: "Products", icon: "products", href: "/products" },
  { label: "Inventory", icon: "inventory", href: "/inventory" },
  { label: "Customers", icon: "customers", href: "/customers" },
  { label: "Discounts", icon: "tag", href: "/discounts" },
  { label: "Online Store", icon: "store", href: "/builder" },
  { label: "Analytics", icon: "analytics", href: "/analytics" },
  { label: "Settings", icon: "settings", href: "/settings" },
];

/** Routes that render without the merchant admin chrome (auth, builder, and the
 *  platform operator portal, which has its own super-admin shell). */
const BARE_PREFIXES = ["/sign-in", "/onboarding", "/_kitchen-sink", "/builder", "/platform"];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

export function AdminChrome(props: AdminChromeProps) {
  const pathname = usePathname() ?? "";
  const bare = BARE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
  if (bare) return <>{props.children}</>;

  return (
    <ToastProvider>
      <ShellWithPalette {...props} />
    </ToastProvider>
  );
}

function ShellWithPalette(props: AdminChromeProps) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const { store, owner, products, orders, customers } = props;

  const commands = useMemo<Command[]>(() => {
    const actions: Command[] = [
      {
        id: "act-add-product",
        group: "Actions",
        icon: "plus",
        label: "Add product",
        onRun: () => router.push("/products/new"),
      },
      {
        id: "act-publish",
        group: "Actions",
        icon: "sparkle",
        label: "Publish store",
        onRun: () => router.push("/publish"),
      },
      {
        id: "act-view-store",
        group: "Actions",
        icon: "external",
        label: "View storefront",
        onRun: () => window.open(storeOrigin(store.subdomain), "_blank"),
      },
    ];
    const nav: Command[] = NAV.map((n) => ({
      id: `nav-${n.href}`,
      group: "Navigate",
      icon: n.icon,
      label: `Go to ${n.label}`,
      onRun: () => router.push(n.href),
    }));
    const productCmds: Command[] = products.slice(0, 6).map((p) => ({
      id: `prod-${p._id}`,
      group: "Products",
      icon: "box",
      label: p.title,
      keywords: p.handle,
      onRun: () => router.push(`/products/edit/${p._id}`),
    }));
    const orderCmds: Command[] = orders.slice(0, 4).map((o) => ({
      id: `ord-${o._id}`,
      group: "Orders",
      icon: "orders",
      label: `Order #${o.orderNumber} · ${o.contact.name}`,
      keywords: o.contact.email,
      onRun: () => router.push(`/orders/${o._id}`),
    }));
    const customerCmds: Command[] = customers.slice(0, 4).map((c) => ({
      id: `cust-${c._id}`,
      group: "Customers",
      icon: "user",
      label: c.name,
      keywords: c.email,
      onRun: () => router.push(`/customers/${c._id}`),
    }));
    return [...actions, ...nav, ...productCmds, ...orderCmds, ...customerCmds];
  }, [router, products, orders, customers]);

  return (
    <CommandPaletteProvider commands={commands}>
      <div className="admin-shell">
        <Sidebar
          pathname={pathname}
          plan={props.subscription.plan}
          unfulfilledCount={props.unfulfilledCount}
          lowCount={props.lowCount}
          outCount={props.outCount}
        />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <Topbar
            store={store}
            owner={owner}
            stores={props.stores}
            capStatus={props.capStatus}
          />
          <main className="admin-main">
            <div className="admin-content">{props.children}</div>
          </main>
        </div>
      </div>
    </CommandPaletteProvider>
  );
}

function Sidebar({
  pathname,
  plan,
  unfulfilledCount,
  lowCount,
  outCount,
}: {
  pathname: string;
  plan: string;
  unfulfilledCount: number;
  lowCount: number;
  outCount: number;
}) {
  const lowTip = [lowCount > 0 && `${lowCount} low`, outCount > 0 && `${outCount} out`]
    .filter(Boolean)
    .join(" · ");
  return (
    <aside className="admin-sidebar">
      <div className="admin-brand">
        <span className="admin-brand-mark" aria-hidden="true">
          <Icon name="store" size={13} style={{ color: "var(--accent)" }} />
        </span>
        <span className="admin-brand-word">Offshelf</span>
      </div>

      <nav className="admin-nav" aria-label="Primary">
        {NAV.map((n) => {
          const active = isActive(pathname, n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`admin-nav-item${active ? " active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <span className="nav-icon">
                <Icon name={n.icon} size={18} aria-hidden />
              </span>
              <span className="nav-label">{n.label}</span>
              {n.href === "/orders" && unfulfilledCount > 0 && (
                <span className="admin-nav-badge mono">{unfulfilledCount}</span>
              )}
              {n.href === "/inventory" && lowTip && (
                <span className="tip" data-tip={lowTip}>
                  <span className="admin-nav-dot" />
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="admin-plan">
        <Eyebrow>Plan</Eyebrow>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 4,
          }}
        >
          <span
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--text-strong)",
              fontWeight: 500,
              textTransform: "capitalize",
            }}
          >
            {plan}
          </span>
          <Link
            href="/settings"
            className="btn btn-sm btn-ghost"
            style={{ padding: "0 8px", color: "var(--accent-pressed)" }}
          >
            Manage
          </Link>
        </div>
      </div>
    </aside>
  );
}

/**
 * Store switcher (multi-store). The trigger shows the active store name; the menu lists
 * every store the user owns (the active one checked) and a "Create new store" item that
 * is LOCKED with an upgrade hint when the account is at its plan's store cap. Switching
 * and creating both go through ownership/cap-guarded server actions — this UI is purely
 * the entry point, never the authority.
 */
function StoreSwitcher({
  activeStore,
  stores,
  capStatus,
}: {
  activeStore: Store;
  stores: Store[];
  capStatus: StoreCapStatus;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  function switchTo(storeId: string, close: () => void) {
    close();
    if (storeId === activeStore._id) return;
    startTransition(async () => {
      const res = await setActiveStore(storeId);
      if (res.ok) {
        router.push("/dashboard");
        router.refresh();
      } else {
        toast("Couldn't switch store.", { tone: "critical" });
      }
    });
  }

  function onCreate(close: () => void) {
    close();
    startTransition(async () => {
      const res = await createStore();
      if (res.ok) {
        router.push("/onboarding");
        router.refresh();
      } else if (res.reason === "upgrade_required") {
        toast(`Your ${res.plan} plan allows ${res.cap} store${res.cap === 1 ? "" : "s"}. Upgrade to add more.`, {
          tone: "info",
          icon: "lock",
        });
        router.push("/settings");
      } else {
        toast("Couldn't create store.", { tone: "critical" });
      }
    });
  }

  return (
    <Dropdown
      align="left"
      width={260}
      trigger={
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          style={{ padding: "2px 6px", gap: 6, maxWidth: 240 }}
          aria-label="Switch store"
          disabled={pending}
        >
          <span
            style={{
              fontWeight: 600,
              fontSize: "var(--text-sm)",
              color: "var(--text-strong)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {activeStore.name}
          </span>
          <Icon name="chevronDown" size={14} aria-hidden style={{ color: "var(--text-muted)" }} />
        </button>
      }
    >
      {(close) => (
        <>
          <MenuLabel>Your stores</MenuLabel>
          {stores.map((s) => {
            const active = s._id === activeStore._id;
            return (
              <MenuItem
                key={s._id}
                icon="store"
                onClick={() => switchTo(s._id, close)}
                hint={
                  active ? (
                    <Icon name="check" size={14} aria-hidden style={{ color: "var(--accent)" }} />
                  ) : !s.subdomain ? (
                    <span style={{ color: "var(--text-muted)", fontSize: "var(--text-xs)" }}>Draft</span>
                  ) : undefined
                }
              >
                {s.name}
              </MenuItem>
            );
          })}
          <MenuSeparator />
          {capStatus.atCap ? (
            <MenuItem
              icon="lock"
              hint={<span style={{ color: "var(--text-muted)", fontSize: "var(--text-xs)" }}>Upgrade</span>}
              onClick={() => onCreate(close)}
            >
              Create new store
            </MenuItem>
          ) : (
            <MenuItem icon="plus" onClick={() => onCreate(close)}>
              Create new store
            </MenuItem>
          )}
        </>
      )}
    </Dropdown>
  );
}

function Topbar({
  store,
  owner,
  stores,
  capStatus,
}: {
  store: Store;
  owner: User;
  stores: Store[];
  capStatus: StoreCapStatus;
}) {
  const { theme, toggleTheme } = useTheme();
  const { open } = useCommandPalette();
  const router = useRouter();
  const status = storeStatusPill(store.status);

  return (
    <header className="admin-topbar">
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <StoreSwitcher activeStore={store} stores={stores} capStatus={capStatus} />
        <span style={{ color: "var(--warm-300)" }} aria-hidden>
          ·
        </span>
        <span
          className="mono"
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--text-muted)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {storeDomain(store.subdomain)}
        </span>
        <Pill tone={status.tone}>{status.label}</Pill>
      </div>

      <div style={{ flex: 1 }} />

      <button
        type="button"
        className="admin-search"
        onClick={open}
        aria-label="Open command palette"
      >
        <Icon name="search" size={15} aria-hidden />
        <span style={{ flex: 1, textAlign: "left" }}>Search…</span>
        <span className="kbd">⌘K</span>
      </button>

      <IconButton
        name="external"
        size={36}
        tip="View store"
        aria-label="View store"
        onClick={() => window.open(storeOrigin(store.subdomain), "_blank")}
      />
      <IconButton
        name={theme === "dark" ? "sun" : "moon"}
        size={36}
        tip="Toggle theme"
        aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
        onClick={toggleTheme}
      />

      <Dropdown
        align="right"
        trigger={
          <button
            type="button"
            className="iconbtn sz-36"
            style={{ padding: 0 }}
            aria-label="Account menu"
          >
            <Avatar name={owner.name} size={28} />
          </button>
        }
      >
        {(close) => (
          <>
            <div style={{ padding: "6px 10px 8px" }}>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: "var(--text-sm)",
                  color: "var(--text-strong)",
                }}
              >
                {owner.name}
              </div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                {owner.email}
              </div>
            </div>
            <MenuSeparator />
            <MenuItem
              icon="settings"
              onClick={() => {
                router.push("/settings");
                close();
              }}
            >
              Settings
            </MenuItem>
            <MenuItem
              icon="store"
              onClick={() => {
                router.push("/platform");
                close();
              }}
            >
              Platform admin
            </MenuItem>
            <MenuSeparator />
            <MenuLabel>Signed in as merchant</MenuLabel>
            <MenuItem
              icon="external"
              onClick={() => {
                close();
                void doSignOut(); // ends the NextAuth session, then → /sign-in
              }}
            >
              Sign out
            </MenuItem>
          </>
        )}
      </Dropdown>
    </header>
  );
}
