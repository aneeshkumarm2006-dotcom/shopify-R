import type {
  PaymentStatus,
  PlatformEvent,
  PlatformOrderRow,
  PlatformSearchHit,
  RevenueMetrics,
} from "@/types";
import { resolve } from "./_util";
import { getPlan } from "@/lib/payments/billing";
import {
  isDbConfigured,
  dbConnect,
  serializeMany,
  OrderModel,
  StoreModel,
  UserModel,
  ProductModel,
  SubscriptionModel,
  EventModel,
} from "@/lib/db";

/**
 * Cross-tenant operator seams (P2): the global orders stream, plan-based revenue,
 * global search, and the operator audit log. All read across tenants by design and
 * must only be reached behind `requirePlatformAdmin`.
 */

const STUCK_ORDER_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

async function storeNameMap(storeIds: string[]): Promise<Map<string, string>> {
  if (storeIds.length === 0) return new Map();
  const rows = await StoreModel.find({ _id: { $in: storeIds } }, { name: 1 }).lean<
    { _id: string; name: string }[]
  >();
  return new Map(rows.map((s) => [String(s._id), s.name]));
}

export interface OrderStreamFilter {
  paymentStatus?: PaymentStatus;
  /** Only unpaid COD/in-store orders past the stuck threshold. */
  stuckOnly?: boolean;
}

/** Every order across all stores, newest first — the operator commerce monitor. */
export async function getPlatformOrders(
  filter: OrderStreamFilter = {},
  limit = 100,
): Promise<PlatformOrderRow[]> {
  if (!isDbConfigured()) return resolve([]);
  await dbConnect();
  const cutoff = new Date(Date.now() - STUCK_ORDER_DAYS * DAY_MS);

  const q: Record<string, unknown> = {};
  if (filter.paymentStatus) q.paymentStatus = filter.paymentStatus;
  if (filter.stuckOnly) {
    q.paymentStatus = "pending";
    q.settlementMethod = { $in: ["cod", "in_store"] };
    q.createdAt = { $lt: cutoff };
  }

  const orders = await OrderModel.find(q).sort({ createdAt: -1 }).limit(limit).lean();
  const names = await storeNameMap([...new Set(orders.map((o) => String(o.storeId)))]);
  const cutoffMs = cutoff.getTime();

  return orders.map((o) => {
    const settlementMethod = (o.settlementMethod ?? "online") as PlatformOrderRow["settlementMethod"];
    const createdMs = new Date(o.createdAt as unknown as string).getTime();
    const stuck =
      o.paymentStatus === "pending" &&
      (settlementMethod === "cod" || settlementMethod === "in_store") &&
      createdMs < cutoffMs;
    return {
      id: String(o._id),
      orderNumber: o.orderNumber,
      storeId: String(o.storeId),
      storeName: names.get(String(o.storeId)) ?? "—",
      total: o.total,
      paymentStatus: o.paymentStatus,
      fulfillmentStatus: o.fulfillmentStatus,
      settlementMethod,
      createdAt: new Date(o.createdAt as unknown as string).toISOString(),
      stuck,
    };
  });
}

/** Plan-based revenue snapshot (MRR = active paid plans × catalog price). */
export async function getRevenueMetrics(): Promise<RevenueMetrics> {
  if (!isDbConfigured()) {
    return { mrr: 0, payingAccounts: 0, freeAccounts: 0, standardAccounts: 0 };
  }
  await dbConnect();
  const subs = await SubscriptionModel.find({ status: "active" }, { plan: 1 }).lean<
    { plan?: string }[]
  >();
  let mrr = 0;
  let standardAccounts = 0;
  let freeAccounts = 0;
  for (const s of subs) {
    const plan = (s.plan ?? "free") as "free" | "standard";
    mrr += getPlan(plan).priceMonthly;
    if (plan === "standard") standardAccounts += 1;
    else freeAccounts += 1;
  }
  return { mrr, payingAccounts: standardAccounts, freeAccounts, standardAccounts };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Cross-tenant global search — stores, users, orders, products. */
export async function platformSearch(rawQuery: string, perKind = 5): Promise<PlatformSearchHit[]> {
  const q = rawQuery.trim();
  if (!q || !isDbConfigured()) return [];
  await dbConnect();
  const rx = new RegExp(escapeRegex(q), "i");
  const orderNum = Number.parseInt(q.replace(/^#/, ""), 10);

  const [stores, users, products, orders] = await Promise.all([
    StoreModel.find({ $or: [{ name: rx }, { subdomain: rx }] }, { name: 1, subdomain: 1 })
      .limit(perKind)
      .lean<{ _id: string; name: string; subdomain?: string }[]>(),
    UserModel.find({ $or: [{ email: rx }, { name: rx }] }, { email: 1, name: 1 })
      .limit(perKind)
      .lean<{ _id: string; email: string; name: string }[]>(),
    ProductModel.find({ title: rx }, { title: 1, storeId: 1 })
      .limit(perKind)
      .lean<{ _id: string; title: string; storeId: string }[]>(),
    Number.isNaN(orderNum)
      ? Promise.resolve([])
      : OrderModel.find({ orderNumber: orderNum }, { orderNumber: 1, storeId: 1, total: 1 })
          .limit(perKind)
          .lean<{ _id: string; orderNumber: number; storeId: string; total: number }[]>(),
  ]);

  const hits: PlatformSearchHit[] = [];
  for (const s of stores) {
    hits.push({ kind: "store", id: String(s._id), label: s.name, sub: s.subdomain, href: `/platform/stores/${s._id}` });
  }
  for (const u of users) {
    hits.push({ kind: "user", id: String(u._id), label: u.email, sub: u.name, href: `/platform/users` });
  }
  for (const o of orders) {
    hits.push({ kind: "order", id: String(o._id), label: `Order #${o.orderNumber}`, sub: `$${o.total}`, href: `/platform/stores/${o.storeId}` });
  }
  for (const p of products) {
    hits.push({ kind: "product", id: String(p._id), label: p.title, href: `/platform/stores/${p.storeId}` });
  }
  return hits;
}

/** The operator audit log — actions taken by platform admins (suspend, impersonate, …). */
export async function getOperatorAuditLog(limit = 100): Promise<PlatformEvent[]> {
  if (!isDbConfigured()) return resolve([]);
  await dbConnect();
  return serializeMany<PlatformEvent>(
    await EventModel.find({ actorType: "platform_admin" })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean(),
  );
}
