import { Schema } from "mongoose";
import { defineModel, stringId } from "./_shared";

/**
 * One-time storefront login code (passwordless sign-in, Shopify's current model). One
 * active document per `(storeId, email)` — a new request replaces the old, so only the
 * latest code is valid. `codeHash` is an HMAC of the 6-digit code (never stored raw),
 * `attempts` caps guessing, and a TTL index on `expiresAt` deletes spent/expired codes
 * automatically (no cron). `timestamps: false` — `expiresAt` is the only time we need.
 */
const LoginCodeSchema = new Schema(
  {
    _id: stringId,
    storeId: { type: String, required: true },
    email: { type: String, required: true }, // lowercased
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false, timestamps: false },
);

LoginCodeSchema.index({ storeId: 1, email: 1 }, { unique: true });
// TTL — MongoDB removes the doc once expiresAt passes.
LoginCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const LoginCodeModel = defineModel("LoginCode", LoginCodeSchema);
