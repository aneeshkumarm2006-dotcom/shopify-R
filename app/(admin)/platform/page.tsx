import type { Metadata } from "next";
import { getPlatformStores } from "@/lib/data";
import { requirePlatformAdmin } from "@/lib/auth";
import { PlatformAdmin } from "@/components/admin/platform";

export const metadata: Metadata = { title: "Platform admin" };

export default async function PlatformPage() {
  await requirePlatformAdmin(); // cross-tenant operator view — platform_admin role only (Stage 14)
  const stores = await getPlatformStores();
  return <PlatformAdmin stores={stores} />;
}
