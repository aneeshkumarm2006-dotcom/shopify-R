import type { ActorType, EventTarget, PlatformEvent } from "@/types";
import { resolve } from "./_util";
import {
  isDbConfigured,
  dbConnect,
  serializeMany,
  EventModel,
  StoreModel,
  UserModel,
} from "@/lib/db";

/**
 * Activity/audit log seam (platform operator observability). `recordEvent` is the
 * thin write the merchant + operator server actions call AFTER a successful change;
 * it is FIRE-AND-FORGET and never throws into the caller (a logging failure must not
 * break a merchant's save) and a NO-OP without a DB. Reads are operator-only (gated
 * by `requirePlatformAdmin` at the call site) and cross-tenant by design.
 */

export interface RecordEventInput {
  type: string;
  storeId?: string | null;
  actorUserId?: string | null;
  actorType?: ActorType;
  target?: EventTarget;
  metadata?: Record<string, unknown>;
}

export async function recordEvent(input: RecordEventInput): Promise<void> {
  if (!isDbConfigured()) return;
  try {
    // Pull ip/ua from the request when there is one (server actions have request
    // scope; the jwt callback may not — hence the inner guard).
    let ip: string | null = null;
    let ua: string | null = null;
    try {
      const { headers } = await import("next/headers");
      const h = await headers();
      ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
      ua = h.get("user-agent") || null;
    } catch {
      /* no request scope — leave ip/ua null */
    }
    await dbConnect();
    await EventModel.create({
      type: input.type,
      storeId: input.storeId ?? null,
      actorUserId: input.actorUserId ?? null,
      actorType: input.actorType ?? "merchant",
      target: input.target ?? null,
      metadata: input.metadata ?? {},
      ip,
      ua,
    });
  } catch {
    /* observability must never break the action that triggered it */
  }
}

export interface EventFilter {
  storeId?: string;
  actorUserId?: string;
  type?: string;
}

/** Global activity feed (operator) — newest first, capped. */
export async function getEvents(filter: EventFilter = {}, limit = 100): Promise<PlatformEvent[]> {
  if (!isDbConfigured()) return resolve([]);
  await dbConnect();
  const q: Record<string, unknown> = {};
  if (filter.storeId) q.storeId = filter.storeId;
  if (filter.actorUserId) q.actorUserId = filter.actorUserId;
  if (filter.type) q.type = filter.type;
  return serializeMany<PlatformEvent>(
    await EventModel.find(q).sort({ createdAt: -1 }).limit(limit).lean(),
  );
}

/** One store's timeline (operator store-detail view). */
export async function getStoreEvents(storeId: string, limit = 50): Promise<PlatformEvent[]> {
  return getEvents({ storeId }, limit);
}

export interface EventFeed {
  events: PlatformEvent[];
  /** storeId → store name, for rendering events without an extra lookup per row. */
  storeNames: Record<string, string>;
  /** actorUserId → email. */
  actorEmails: Record<string, string>;
}

/**
 * The activity feed plus resolved display names (store name, actor email) so the
 * operator UI can render human-readable rows from the id-only event docs.
 */
export async function getEventFeed(filter: EventFilter = {}, limit = 100): Promise<EventFeed> {
  const events = await getEvents(filter, limit);
  if (!isDbConfigured() || events.length === 0) {
    return { events, storeNames: {}, actorEmails: {} };
  }
  const storeIds = [...new Set(events.map((e) => e.storeId).filter(Boolean))] as string[];
  const userIds = [...new Set(events.map((e) => e.actorUserId).filter(Boolean))] as string[];
  const [stores, users] = await Promise.all([
    StoreModel.find({ _id: { $in: storeIds } }, { name: 1 }).lean<{ _id: string; name: string }[]>(),
    UserModel.find({ _id: { $in: userIds } }, { email: 1 }).lean<{ _id: string; email: string }[]>(),
  ]);
  const storeNames: Record<string, string> = {};
  for (const s of stores) storeNames[String(s._id)] = s.name;
  const actorEmails: Record<string, string> = {};
  for (const u of users) actorEmails[String(u._id)] = u.email;
  return { events, storeNames, actorEmails };
}
