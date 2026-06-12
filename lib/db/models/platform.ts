import { Schema } from "mongoose";
import { baseSchemaOptions, defineModel, stringId } from "./_shared";

/* ============================================================
   Platform operator activity/audit log (append-only).
   Cross-tenant by design (operators read across stores); writes always stamp the
   `storeId`/`actorUserId` they belong to, so per-store + per-actor reads stay
   index-backed. Self-expiring via a TTL index to bound storage (90-day window).
   ============================================================ */
const EventTargetSchema = new Schema(
  { kind: { type: String, required: true }, id: { type: String }, label: { type: String } },
  { _id: false },
);

const EventSchema = new Schema(
  {
    _id: stringId,
    actorUserId: { type: String, default: null },
    actorType: {
      type: String,
      enum: ["merchant", "platform_admin", "system"],
      default: "merchant",
    },
    storeId: { type: String, default: null },
    type: { type: String, required: true },
    target: { type: EventTargetSchema, default: null },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) },
    ip: { type: String, default: null },
    ua: { type: String, default: null },
  },
  baseSchemaOptions,
);

EventSchema.index({ createdAt: -1 }); // global feed
EventSchema.index({ storeId: 1, createdAt: -1 }); // per-store timeline
EventSchema.index({ actorUserId: 1, createdAt: -1 }); // per-merchant trail
EventSchema.index({ type: 1, createdAt: -1 }); // filter by type
// Retention: events self-expire after 90 days (operator audit window / storage cap).
EventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

export const EventModel = defineModel("Event", EventSchema);
