import type { Id, ISODate, Timestamps } from "./common";

/* ============================================================
   5.1 users (merchant accounts)
   ============================================================ */
export type UserRole = "merchant" | "platform_admin";

export interface User extends Timestamps {
  _id: Id;
  email: string; // unique; from Google OAuth
  name: string;
  googleId: string; // OAuth subject
  activeStoreId: Id; // the store currently selected in the dashboard (switchable)
  primaryStoreId: Id; // first store; anchors the account's effective plan
  role: UserRole; // `merchant` (reserved: `platform_admin`)
}

/* ============================================================
   5.2 stores (tenant root)
   ============================================================ */
export type StoreStatus = "draft" | "live" | "suspended";

export interface AgeGate {
  enabled: boolean;
  minAge: number; // flat 21+ in MVP
  message: string;
}

/**
 * One shipping rate the merchant offers (Phase 2). `price` is a flat amount in the
 * store's currency. `freeOver` (when set) zeroes the rate once the discounted
 * subtotal reaches it (free-shipping threshold). `regions` (when non-empty) limits
 * the rate to specific shipping regions/states (matched case-insensitively); an
 * empty/absent list means the rate applies everywhere.
 */
export interface ShippingRate {
  id: string;
  label: string;
  price: number;
  freeOver?: number | null;
  regions?: string[];
}

/** Per-store shipping configuration (Phase 2). When disabled or empty, checkout
 *  falls back to a single free "Standard" rate so totals never break. */
export interface ShippingSettings {
  enabled: boolean;
  rates: ShippingRate[];
}

/** A region/state tax-rate override (Phase 2), e.g. `{ region: "CA", rate: 7.25 }`. */
export interface TaxRegionRate {
  region: string;
  rate: number; // percent (0–100)
}

/**
 * Per-store tax configuration (Phase 2). `rate` is the default percent applied to
 * the discounted subtotal; `regionRates` override it for specific regions. When
 * `appliesToShipping` is set, shipping is added to the taxable base. Disabled by
 * default so a store with no tax setup is charged exactly subtotal − discount.
 */
export interface TaxSettings {
  enabled: boolean;
  rate: number; // default percent (0–100)
  label?: string; // e.g. "Sales tax", "VAT"
  appliesToShipping?: boolean;
  regionRates?: TaxRegionRate[];
}

export interface StoreSettings {
  currency: string; // display symbol, e.g. "$"
  /**
   * Optional ISO-4217 currency code (e.g. "USD", "EUR", "GBP"). When set, money is
   * formatted with `Intl.NumberFormat` (correct symbol + placement) and takes
   * precedence over the bare `currency` symbol. No FX — a store has one currency.
   */
  currencyCode?: string;
  contactEmail: string;
  socialLinks?: { label: string; url: string }[];
  logoUrl?: string; // Cloudinary URL
  /**
   * Which settlement methods the storefront offers at checkout. High-risk verticals
   * lean on cash-on-delivery / pay-in-store since card processors refuse the category.
   * `online` reflects the (stubbed) processor path. Defaults applied in the data layer.
   */
  settlement?: {
    online: boolean;
    cod: boolean;
    inStore: boolean;
  };
  /** Tax engine config (Phase 2). Absent → no tax charged. */
  tax?: TaxSettings;
  /** Shipping engine config (Phase 2). Absent → single free "Standard" rate. */
  shipping?: ShippingSettings;
}

export interface SeoDefaults {
  title: string;
  description: string;
  ogImage?: string;
}

export interface CodeInjection {
  headHtml: string;
  bodyHtml: string;
  customCss: string;
  customJs: string;
}

export interface Store extends Timestamps {
  _id: Id;
  ownerId: Id; // → users
  name: string;
  subdomain: string; // unique, lowercase, DNS-safe
  status: StoreStatus;
  ageGate: AgeGate;
  settings: StoreSettings;
  seoDefaults: SeoDefaults;
  codeInjection: CodeInjection;
  publishedAt?: ISODate; // set when first published
  /** When set, a cron auto-publishes the store at this time (Phase 6). Cleared on publish. */
  scheduledPublishAt?: ISODate | null;
}

/* ============================================================
   5.3 themeConfig (one per store — the builder's output)
   Mirrors Shopify's sections/blocks model.
   ============================================================ */

/** Closed MVP section set (PRD §5.3 / §6.2). No types beyond this. */
export type SectionType =
  | "hero"
  | "featured_products"
  | "collection_list"
  | "rich_text"
  | "image_with_text"
  | "gallery"
  | "newsletter_static"
  | "custom_html"
  | "header"
  | "footer";

/** Type-specific settings bag. Kept permissive at the type level; each section
 *  component narrows what it reads. */
export type SectionSettings = Record<string, unknown>;
export type BlockSettings = Record<string, unknown>;

export interface Block {
  id: Id;
  type: string;
  settings: BlockSettings;
}

export interface Section {
  id: Id;
  type: SectionType;
  settings: SectionSettings;
  blockOrder: Id[];
  blocks: Record<Id, Block>;
}

export interface Template {
  sectionOrder: Id[];
  sections: Record<Id, Section>;
}

export type TemplateKey = "home" | "product" | "collection" | "page" | "cart";

export interface ThemeConfig extends Timestamps {
  storeId: Id;
  templates: Record<TemplateKey, Template>;
  header: Section; // shared across templates
  footer: Section; // shared across templates
}

/** A saved snapshot of a theme config (Phase 6 version history). */
export interface ThemeVersion extends Timestamps {
  _id: Id;
  storeId: Id;
  label: string; // auto ("Autosave") or merchant-supplied
  snapshot: {
    templates: Record<TemplateKey, Template>;
    header: Section;
    footer: Section;
  };
}

/* ============================================================
   Locations (Phase 6) — multi-location inventory. Each store has ≥1 location;
   per-variant stock is tracked per location and summed into the sellable total.
   ============================================================ */
export interface Location extends Timestamps {
  _id: Id;
  storeId: Id;
  name: string;
  isDefault: boolean; // the fallback location new stock lands in
}

/* ============================================================
   Staff accounts & RBAC (Phase 6) — multiple users per store with roles.
   ============================================================ */
/** Roles, most→least privileged. The store's `ownerId` user is always `owner`. */
export type StoreRole = "owner" | "admin" | "staff";

/** An invited member exists before its user signs in; it activates on first access. */
export type StoreMemberStatus = "invited" | "active";

/** Capability keys gated by role (one per admin area that needs protection). */
export type Permission =
  | "products"
  | "orders"
  | "customers"
  | "discounts"
  | "marketing"
  | "content" // builder / theme
  | "analytics"
  | "settings"
  | "publish"
  | "staff"; // manage other members (owner-only)

export interface StoreMember extends Timestamps {
  _id: Id;
  storeId: Id;
  email: string; // invitation key; matches the user's account email
  userId?: Id | null; // linked once that email signs in
  name?: string;
  role: StoreRole;
  status: StoreMemberStatus;
}

/* ============================================================
   5.10 subscriptions (platform billing — stub)
   ============================================================ */
export type SubscriptionPlan = "free" | "standard";
export type SubscriptionStatus = "active";

export interface Subscription extends Timestamps {
  _id: Id;
  ownerId: Id;
  storeId: Id;
  plan: SubscriptionPlan;
  status: SubscriptionStatus; // manually provisioned in MVP
  billingSeam: Record<string, unknown>; // reserved for future processor wiring
}
