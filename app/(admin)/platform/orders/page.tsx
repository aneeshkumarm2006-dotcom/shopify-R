import type { Metadata } from "next";
import { getPlatformOrders } from "@/lib/data";
import { requirePlatformAdmin } from "@/lib/auth";
import {
  PlatformOrders,
  ORDER_FILTERS,
  type OrderFilter,
} from "@/components/admin/platform-orders";

export const metadata: Metadata = { title: "Orders" };

/** Collapse a `searchParam` (string | string[] | undefined) to a single trimmed value. */
function first(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  const trimmed = v?.trim();
  return trimmed ? trimmed : undefined;
}

function toFilter(raw: string | undefined): OrderFilter {
  return ORDER_FILTERS.includes(raw as OrderFilter) ? (raw as OrderFilter) : "all";
}

export default async function PlatformOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePlatformAdmin(); // cross-tenant operator view — platform_admin role only (Stage 14)
  const sp = await searchParams;
  const filter = toFilter(first(sp.filter));

  const arg =
    filter === "stuck"
      ? { stuckOnly: true }
      : filter === "all"
        ? {}
        : { paymentStatus: filter };

  const orders = await getPlatformOrders(arg, 200);
  return <PlatformOrders orders={orders} activeFilter={filter} />;
}
