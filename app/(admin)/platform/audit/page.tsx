import type { Metadata } from "next";
import { getOperatorAuditLog } from "@/lib/data";
import { requirePlatformAdmin } from "@/lib/auth";
import { PlatformAudit } from "@/components/admin/platform-audit";

export const metadata: Metadata = { title: "Audit log" };

export default async function PlatformAuditPage() {
  await requirePlatformAdmin(); // cross-tenant operator view — platform_admin role only (Stage 14)
  const events = await getOperatorAuditLog(100);
  return <PlatformAudit events={events} />;
}
