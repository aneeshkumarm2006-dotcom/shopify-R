import type { Metadata } from "next";
import { getSystemHealth, getEmailLog } from "@/lib/data";
import { requirePlatformAdmin } from "@/lib/auth";
import { PlatformSystem } from "@/components/admin/platform-system";

export const metadata: Metadata = { title: "System" };

export default async function PlatformSystemPage() {
  await requirePlatformAdmin(); // cross-tenant operator view — platform_admin role only (Stage 14)
  const [health, emails] = await Promise.all([getSystemHealth(), getEmailLog({}, 50)]);
  return <PlatformSystem health={health} emails={emails} />;
}
