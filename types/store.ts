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

export interface StoreSettings {
  currency: string; // display symbol, e.g. "$"
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
