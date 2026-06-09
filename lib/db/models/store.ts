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
    googleId: { type: String, required: true, unique: true }, // OAuth subject
    storeId: { type: String, unique: true, sparse: true }, // 1:1 store ownership (MVP)
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
    ownerId: { type: String, required: true },
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
  },
  baseSchemaOptions,
);

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

export const UserModel = defineModel("User", UserSchema);
export const StoreModel = defineModel("Store", StoreSchema);
export const ThemeConfigModel = defineModel("ThemeConfig", ThemeConfigSchema);
export const SubscriptionModel = defineModel("Subscription", SubscriptionSchema);
