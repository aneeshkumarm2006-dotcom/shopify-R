import type { PlatformTraffic, StoreTraffic, TrafficPoint } from "@/types";
import { resolve } from "./_util";
import { isDbConfigured, dbConnect, PageViewModel, StoreModel } from "@/lib/db";

/**
 * Storefront visitor analytics (operator P4). `recordPageview` is the fire-and-forget
 * write the `/api/track` beacon calls; the rest are operator-only aggregations.
 * Privacy: a pageview stores a random client `sessionId` + path only — NO IP, no PII.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export interface RecordPageviewInput {
  storeId: string;
  sessionId?: string | null;
  path?: string | null;
  ref?: string | null;
}

export async function recordPageview(input: RecordPageviewInput): Promise<void> {
  if (!isDbConfigured()) return;
  try {
    await dbConnect();
    await PageViewModel.create({
      storeId: input.storeId,
      sessionId: input.sessionId ? String(input.sessionId).slice(0, 64) : null,
      path: input.path ? String(input.path).slice(0, 512) : "/",
      ref: input.ref ? String(input.ref).slice(0, 512) : null,
    });
  } catch {
    /* analytics must never break the storefront */
  }
}

function emptyByDay(days: number): TrafficPoint[] {
  const out: TrafficPoint[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * DAY_MS);
    out.push({ date: d.toISOString().slice(0, 10), views: 0 });
  }
  return out;
}

/** Per-store traffic for the operator store-detail view. */
export async function getStoreTraffic(storeId: string, days = 30): Promise<StoreTraffic> {
  if (!isDbConfigured()) return resolve({ views: 0, sessions: 0, byDay: emptyByDay(days), topPaths: [] });
  await dbConnect();
  const since = new Date(Date.now() - days * DAY_MS);
  const match = { storeId, createdAt: { $gte: since } };

  const [totals, byDayRaw, topPathsRaw] = await Promise.all([
    PageViewModel.aggregate([
      { $match: match },
      { $group: { _id: null, views: { $sum: 1 }, sessions: { $addToSet: "$sessionId" } } },
    ]),
    PageViewModel.aggregate([
      { $match: match },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, views: { $sum: 1 } } },
    ]),
    PageViewModel.aggregate([
      { $match: match },
      { $group: { _id: "$path", views: { $sum: 1 } } },
      { $sort: { views: -1 } },
      { $limit: 10 },
    ]),
  ]);

  const t = totals[0] as { views?: number; sessions?: (string | null)[] } | undefined;
  const dayMap = new Map<string, number>(
    (byDayRaw as { _id: string; views: number }[]).map((d) => [d._id, d.views]),
  );
  return {
    views: t?.views ?? 0,
    sessions: (t?.sessions ?? []).filter(Boolean).length,
    byDay: emptyByDay(days).map((p) => ({ date: p.date, views: dayMap.get(p.date) ?? 0 })),
    topPaths: (topPathsRaw as { _id: string; views: number }[]).map((p) => ({ path: p._id, views: p.views })),
  };
}

/** Platform-wide traffic + top stores by traffic (operator overview). */
export async function getPlatformTraffic(days = 30): Promise<PlatformTraffic> {
  if (!isDbConfigured()) return resolve({ totalViews: 0, totalSessions: 0, byDay: emptyByDay(days), topStores: [] });
  await dbConnect();
  const since = new Date(Date.now() - days * DAY_MS);
  const match = { createdAt: { $gte: since } };

  const [totals, byDayRaw, topStoresRaw] = await Promise.all([
    PageViewModel.aggregate([
      { $match: match },
      { $group: { _id: null, views: { $sum: 1 }, sessions: { $addToSet: "$sessionId" } } },
    ]),
    PageViewModel.aggregate([
      { $match: match },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, views: { $sum: 1 } } },
    ]),
    PageViewModel.aggregate([
      { $match: match },
      { $group: { _id: "$storeId", views: { $sum: 1 }, sessions: { $addToSet: "$sessionId" } } },
      { $sort: { views: -1 } },
      { $limit: 10 },
    ]),
  ]);

  const t = totals[0] as { views?: number; sessions?: (string | null)[] } | undefined;
  const dayMap = new Map<string, number>(
    (byDayRaw as { _id: string; views: number }[]).map((d) => [d._id, d.views]),
  );
  const top = topStoresRaw as { _id: string; views: number; sessions: (string | null)[] }[];
  const names = top.length
    ? new Map(
        (
          await StoreModel.find({ _id: { $in: top.map((s) => s._id) } }, { name: 1 }).lean<
            { _id: string; name: string }[]
          >()
        ).map((s) => [String(s._id), s.name]),
      )
    : new Map<string, string>();

  return {
    totalViews: t?.views ?? 0,
    totalSessions: (t?.sessions ?? []).filter(Boolean).length,
    byDay: emptyByDay(days).map((p) => ({ date: p.date, views: dayMap.get(p.date) ?? 0 })),
    topStores: top.map((s) => ({
      storeId: s._id,
      storeName: names.get(s._id) ?? "—",
      views: s.views,
      sessions: s.sessions.filter(Boolean).length,
    })),
  };
}
