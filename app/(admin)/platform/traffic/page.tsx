import type { Metadata } from "next";
import { getPlatformTraffic } from "@/lib/data";
import { requirePlatformAdmin } from "@/lib/auth";
import { PlatformTraffic } from "@/components/admin/platform-traffic";

export const metadata: Metadata = { title: "Traffic" };

export default async function PlatformTrafficPage() {
  await requirePlatformAdmin(); // cross-tenant operator view — platform_admin role only (Stage 14)
  const traffic = await getPlatformTraffic(30);
  return <PlatformTraffic traffic={traffic} />;
}
