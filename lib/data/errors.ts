import type { ErrorSeverity, NeedsAttention, PlatformError } from "@/types";
import { resolve } from "./_util";
import { getMisalignedStores } from "./platform";
import {
  isDbConfigured,
  dbConnect,
  serializeMany,
  serializeOrNull,
  ErrorModel,
  StoreModel,
  OrderModel,
} from "@/lib/db";

/**
 * Platform error / incident log (operator "what broke"). `recordError` is the
 * fire-and-forget seam wired into catch-blocks (checkout, payment webhook, failing
 * actions) — it NEVER throws into the caller and is a NO-OP without a DB. Reads are
 * operator-only (gated by `requirePlatformAdmin` at the call site). Unlike the event
 * log (successes), this captures failures so they can be triaged + resolved.
 */

export interface RecordErrorInput {
  source: string;
  message: string;
  stack?: string | null;
  severity?: ErrorSeverity;
  storeId?: string | null;
  actorUserId?: string | null;
  metadata?: Record<string, unknown>;
}

export async function recordError(input: RecordErrorInput): Promise<void> {
  if (!isDbConfigured()) return;
  try {
    await dbConnect();
    await ErrorModel.create({
      source: input.source,
      message: input.message.slice(0, 2000),
      stack: input.stack ? input.stack.slice(0, 8000) : null,
      severity: input.severity ?? "error",
      storeId: input.storeId ?? null,
      actorUserId: input.actorUserId ?? null,
      metadata: input.metadata ?? {},
      resolved: false,
    });
  } catch {
    /* error logging must never break the path that triggered it */
  }
}

export interface ErrorFilter {
  resolved?: boolean;
  severity?: ErrorSeverity;
  storeId?: string;
}

export async function getErrors(filter: ErrorFilter = {}, limit = 100): Promise<PlatformError[]> {
  if (!isDbConfigured()) return resolve([]);
  await dbConnect();
  const q: Record<string, unknown> = {};
  if (filter.resolved !== undefined) q.resolved = filter.resolved;
  if (filter.severity) q.severity = filter.severity;
  if (filter.storeId) q.storeId = filter.storeId;
  return serializeMany<PlatformError>(
    await ErrorModel.find(q).sort({ createdAt: -1 }).limit(limit).lean(),
  );
}

export async function getOpenErrorCount(): Promise<number> {
  if (!isDbConfigured()) return 0;
  await dbConnect();
  return ErrorModel.countDocuments({ resolved: false });
}

/** Operator marks an incident resolved (or reopens it). */
export async function setErrorResolved(id: string, resolved: boolean): Promise<PlatformError | null> {
  if (!isDbConfigured()) return null;
  await dbConnect();
  return serializeOrNull<PlatformError>(
    await ErrorModel.findByIdAndUpdate(
      id,
      { $set: { resolved, resolvedAt: resolved ? new Date() : null } },
      { new: true },
    ).lean(),
  );
}

/** Days after which an unpaid COD / in-store order is considered "stuck". */
const STUCK_ORDER_DAYS = 3;

/** The operator triage rollup — what needs a human right now. */
export async function getNeedsAttention(): Promise<NeedsAttention> {
  if (!isDbConfigured()) {
    return { openErrors: 0, criticalErrors: 0, misalignedStores: 0, stuckOrders: 0, suspendedStores: 0 };
  }
  await dbConnect();
  const cutoff = new Date(Date.now() - STUCK_ORDER_DAYS * 24 * 60 * 60 * 1000);
  const [openErrors, criticalErrors, misaligned, stuckOrders, suspendedStores] = await Promise.all([
    ErrorModel.countDocuments({ resolved: false }),
    ErrorModel.countDocuments({ resolved: false, severity: "critical" }),
    getMisalignedStores(),
    OrderModel.countDocuments({
      paymentStatus: "pending",
      settlementMethod: { $in: ["cod", "in_store"] },
      createdAt: { $lt: cutoff },
    }),
    StoreModel.countDocuments({ status: "suspended" }),
  ]);
  return {
    openErrors,
    criticalErrors,
    misalignedStores: misaligned.length,
    stuckOrders,
    suspendedStores,
  };
}
