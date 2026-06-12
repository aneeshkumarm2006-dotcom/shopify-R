import type { Metadata } from "next";
import { getPlatformKpis, getPlatformUsers } from "@/lib/data";
import { requirePlatformAdmin } from "@/lib/auth";
import { PlatformBilling } from "@/components/admin/platform-billing";

export const metadata: Metadata = { title: "Billing" };

export default async function PlatformBillingPage() {
  await requirePlatformAdmin(); // cross-tenant operator view — platform_admin role only (Stage 14)
  const [kpis, users] = await Promise.all([getPlatformKpis(), getPlatformUsers()]);
  return <PlatformBilling kpis={kpis} users={users} />;
}
