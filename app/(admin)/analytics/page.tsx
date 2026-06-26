import type { Metadata } from "next";
import { getStoreAnalytics, getStore } from "@/lib/data";
import { requireMerchantStoreId } from "@/lib/auth";
import { storeCurrency } from "@/lib/format";
import { AnalyticsView } from "@/components/admin/analytics-view";

export const metadata: Metadata = { title: "Analytics" };

/**
 * Analytics (Phase 6) — funnel (visitors → carts → orders), traffic attribution,
 * join cohorts with repeat rate, top products, and a daily sales series. Period
 * toggle (7d/30d) is read from the query string.
 */
export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: periodParam } = await searchParams;
  const period = periodParam === "7d" ? "7d" : "30d";
  const storeId = await requireMerchantStoreId();
  const [analytics, store] = await Promise.all([
    getStoreAnalytics(storeId, period),
    getStore(storeId),
  ]);
  return <AnalyticsView analytics={analytics} currency={storeCurrency(store?.settings)} />;
}
