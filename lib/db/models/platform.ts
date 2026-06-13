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

/* ============================================================
   Platform errors / incidents (append-only; operator resolves them).
   ============================================================ */
const ErrorSchema = new Schema(
  {
    _id: stringId,
    source: { type: String, required: true },
    message: { type: String, required: true },
    stack: { type: String, default: null },
    severity: {
      type: String,
      enum: ["info", "warning", "error", "critical"],
      default: "error",
    },
    storeId: { type: String, default: null },
    actorUserId: { type: String, default: null },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) },
    resolved: { type: Boolean, default: false },
    resolvedAt: { type: Date, default: null },
  },
  baseSchemaOptions,
);
ErrorSchema.index({ resolved: 1, createdAt: -1 }); // open-incidents queue
ErrorSchema.index({ storeId: 1, createdAt: -1 }); // per-store errors
ErrorSchema.index({ severity: 1, createdAt: -1 });
// Errors retained longer than events (180-day audit window).
ErrorSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 180 });

export const ErrorModel = defineModel("PlatformError", ErrorSchema);

/* ============================================================
   Store notes (operator support annotations on a tenant).
   ============================================================ */
const StoreNoteSchema = new Schema(
  {
    _id: stringId,
    storeId: { type: String, required: true },
    authorId: { type: String, default: null },
    authorEmail: { type: String, default: null },
    body: { type: String, required: true },
  },
  baseSchemaOptions,
);
StoreNoteSchema.index({ storeId: 1, createdAt: -1 });

export const StoreNoteModel = defineModel("StoreNote", StoreNoteSchema);

/* ============================================================
   Email delivery log (operator comms log).
   ============================================================ */
const EmailLogSchema = new Schema(
  {
    _id: stringId,
    to: { type: String, required: true },
    subject: { type: String, default: "" },
    kind: { type: String, default: "" },
    storeId: { type: String, default: null },
    status: { type: String, enum: ["sent", "failed"], default: "sent" },
    error: { type: String, default: null },
  },
  baseSchemaOptions,
);
EmailLogSchema.index({ createdAt: -1 });
EmailLogSchema.index({ storeId: 1, createdAt: -1 });
EmailLogSchema.index({ status: 1, createdAt: -1 });
EmailLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

export const EmailLogModel = defineModel("EmailLog", EmailLogSchema);

/* ============================================================
   Storefront pageviews (visitor analytics). High-volume, short retention.
   ============================================================ */
const PageViewSchema = new Schema(
  {
    _id: stringId,
    storeId: { type: String, required: true },
    sessionId: { type: String, default: null }, // random client id; no PII
    path: { type: String, default: "/" },
    ref: { type: String, default: null },
  },
  baseSchemaOptions,
);
PageViewSchema.index({ storeId: 1, createdAt: -1 });
// High-volume + only needed for recent trends → 30-day TTL.
PageViewSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

export const PageViewModel = defineModel("PageView", PageViewSchema);
