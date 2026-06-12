import type { Metadata } from "next";
import { getEventFeed } from "@/lib/data";
import { requirePlatformAdmin } from "@/lib/auth";
import { PlatformActivity } from "@/components/admin/platform-activity";

export const metadata: Metadata = { title: "Activity" };

/** Collapse a `searchParam` (string | string[] | undefined) to a single trimmed value. */
function first(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  const trimmed = v?.trim();
  return trimmed ? trimmed : undefined;
}

export default async function PlatformActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePlatformAdmin(); // cross-tenant operator view — platform_admin role only (Stage 14)
  const sp = await searchParams;
  const type = first(sp.type);
  const storeId = first(sp.store);
  const feed = await getEventFeed({ type, storeId }, 200);
  return <PlatformActivity feed={feed} activeType={type} />;
}
