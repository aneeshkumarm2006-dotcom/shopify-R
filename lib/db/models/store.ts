import { Schema } from "mongoose";
import { baseSchemaOptions, defineModel, stringId } from "./_shared";

/* ============================================================
   5.1 users (merchant accounts)
   ============================================================ */
const UserSchema = new Schema(
  {
    _id: stringId,
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true },
    // Auth identity — a user may sign in with Google, email+password, or both.
    // `googleId` is set on OAuth sign-in; `passwordHash` on credential sign-up.
    // Both are optional+sparse so an account can exist with only one of them,
    // while `email` (unique above) stays the canonical account key.
    googleId: { type: String, unique: true, sparse: true }, // OAuth subject (sub)
    passwordHash: { type: String }, // scrypt hash for email+password sign-in
    // Multi-store ownership: a user owns N stores (queried via `Store.ownerId`).
    // `activeStoreId` is the currently-selected store (NOT unique — many users may
    // point at one of their own); `primaryStoreId` is the first store, the anchor
    // for the account's effective plan (`getAccountPlan`). Both sparse: unset for a
    // brand-new user until provisioning sets them.
    activeStoreId: { type: String, sparse: true },
    primaryStoreId: { type: String, sparse: true },
    role: { type: String, enum: ["merchant", "platform_admin"], default: "merchant" },
  },
  baseSchemaOptions,
);

/* ============================================================
   5.2 stores (tenant root) — `_id` IS the storeId
   ============================================================ */
const AgeGateSchema = new Schema(
  {
    enabled: { type: Boolean, default: true },
    minAge: { type: Number, default: 21 },
    message: { type: String, default: "" },
  },
  { _id: false },
);

const StoreSchema = new Schema(
  {
    _id: stringId,
    ownerId: { type: String, required: true, index: true }, // fan-out key: all stores a user owns
    name: { type: String, required: true },
    // Unique but SPARSE + optional: a store is provisioned at first login (Stage 7)
    // *before* the merchant claims an address in onboarding, so the field is unset
    // until then. Sparse lets many just-provisioned stores coexist with no
    // subdomain while still enforcing global uniqueness once one is claimed.
    subdomain: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    status: { type: String, enum: ["draft", "live", "suspended"], default: "draft" },
    ageGate: { type: AgeGateSchema, default: () => ({}) },
    settings: { type: Schema.Types.Mixed, default: () => ({}) },
    seoDefaults: { type: Schema.Types.Mixed, default: () => ({}) },
    codeInjection: { type: Schema.Types.Mixed, default: () => ({}) },
    publishedAt: { type: Date },
    scheduledPublishAt: { type: Date, default: null }, // Phase 6 scheduled publish
  },
  baseSchemaOptions,
);
// Cron sweep for due scheduled publishes.
StoreSchema.index({ scheduledPublishAt: 1 });

/* ============================================================
   5.3 themeConfig (one per store — the builder's output)
   The sections/blocks tree is permissive JSON (validated at the type layer and
   by the builder); we persist it as Mixed and scope by storeId (unique).
   ============================================================ */
const ThemeConfigSchema = new Schema(
  {
    _id: stringId,
    storeId: { type: String, required: true, unique: true },
    templates: { type: Schema.Types.Mixed, default: () => ({}) },
    header: { type: Schema.Types.Mixed },
    footer: { type: Schema.Types.Mixed },
  },
  baseSchemaOptions,
);

/* ============================================================
   5.10 subscriptions (platform billing — stub)
   ============================================================ */
const SubscriptionSchema = new Schema(
  {
    _id: stringId,
    ownerId: { type: String, required: true },
    storeId: { type: String, required: true, index: true },
    plan: { type: String, enum: ["free", "standard"], default: "free" },
    status: { type: String, enum: ["active"], default: "active" },
    billingSeam: { type: Schema.Types.Mixed, default: () => ({}) }, // reserved (PRD §6.11)
  },
  baseSchemaOptions,
);

/* ============================================================
   Theme version history (Phase 6) — snapshots of past theme configs.
   ============================================================ */
const ThemeVersionSchema = new Schema(
  {
    _id: stringId,
    storeId: { type: String, required: true },
    label: { type: String, default: "" },
    snapshot: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  baseSchemaOptions,
);
ThemeVersionSchema.index({ storeId: 1, createdAt: -1 });

/* ============================================================
   Staff members (Phase 6) — users with a role on a store (besides the owner).
   ============================================================ */
const StoreMemberSchema = new Schema(
  {
    _id: stringId,
    storeId: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    userId: { type: String, default: null }, // linked on first sign-in
    name: { type: String, default: "" },
    role: { type: String, enum: ["owner", "admin", "staff"], default: "staff" },
    status: { type: String, enum: ["invited", "active"], default: "invited" },
  },
  baseSchemaOptions,
);
// One membership per (store, email); fan out by email (a user's stores) + by store.
StoreMemberSchema.index({ storeId: 1, email: 1 }, { unique: true });
StoreMemberSchema.index({ email: 1 });

/* ============================================================
   Locations (Phase 6) — multi-location inventory.
   ============================================================ */
const LocationSchema = new Schema(
  {
    _id: stringId,
    storeId: { type: String, required: true },
    name: { type: String, required: true },
    isDefault: { type: Boolean, default: false },
  },
  baseSchemaOptions,
);
LocationSchema.index({ storeId: 1, createdAt: 1 });

export const UserModel = defineModel("User", UserSchema);
export const StoreModel = defineModel("Store", StoreSchema);
export const ThemeConfigModel = defineModel("ThemeConfig", ThemeConfigSchema);
export const ThemeVersionModel = defineModel("ThemeVersion", ThemeVersionSchema);
export const StoreMemberModel = defineModel("StoreMember", StoreMemberSchema);
export const LocationModel = defineModel("Location", LocationSchema);
export const SubscriptionModel = defineModel("Subscription", SubscriptionSchema);
