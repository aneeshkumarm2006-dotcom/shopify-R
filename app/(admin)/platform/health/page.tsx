import type { Metadata } from "next";
import { getMisalignedStores } from "@/lib/data";
import { requirePlatformAdmin } from "@/lib/auth";
import { PlatformHealth } from "@/components/admin/platform-health";

export const metadata: Metadata = { title: "Health" };

export default async function PlatformHealthPage() {
  await requirePlatformAdmin(); // cross-tenant operator view — platform_admin role only (Stage 14)
  const stores = await getMisalignedStores();
  return <PlatformHealth stores={stores} />;
}
