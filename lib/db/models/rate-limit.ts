import { Schema } from "mongoose";
import { defineModel } from "./_shared";

/**
 * DB-backed sliding-window rate limit counter.
 *
 * One document per (key, window-epoch) pair. The `_id` is `${key}:${windowStart}`
 * so a single atomic `findOneAndUpdate` with `$inc` + upsert is all that's needed —
 * the same pattern used by `CounterModel` for order sequences. A TTL index on
 * `expiresAt` lets MongoDB delete expired windows automatically with no cron.
 *
 * `timestamps: false` — `expiresAt` is the only time field needed; adding the
 * default `createdAt`/`updatedAt` pair alongside it would be redundant and
 * wasteful for a high-churn collection.
 */
const RateLimitSchema = new Schema(
  {
    _id: { type: String, required: true }, // e.g. "domain-add:store_abc:1719792000"
    key: { type: String, required: true }, // e.g. "domain-add:store_abc"
    count: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false, timestamps: false },
);

// TTL index — MongoDB removes the document once `expiresAt` is in the past.
// expireAfterSeconds: 0 means "expire as soon as the field's timestamp arrives."
RateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
// Support lookup by logical key (e.g. for future metrics queries).
RateLimitSchema.index({ key: 1 });

export const RateLimitModel = defineModel("RateLimit", RateLimitSchema);
