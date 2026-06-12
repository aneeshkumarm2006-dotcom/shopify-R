import type { Metadata } from "next";
import { getPlatformKpis } from "@/lib/data";
import { requirePlatformAdmin } from "@/lib/auth";
import { PlatformOverview } from "@/components/admin/platform-overview";

export const metadata: Metadata = { title: "Overview" };

export default async function PlatformOverviewPage() {
  await requirePlatformAdmin(); // cross-tenant operator view — platform_admin role only (Stage 14)
  const kpis = await getPlatformKpis();
  return <PlatformOverview kpis={kpis} />;
}
