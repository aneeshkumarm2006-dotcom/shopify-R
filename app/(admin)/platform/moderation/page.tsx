import type { Metadata } from "next";
import { getComplianceFlags } from "@/lib/data";
import { requirePlatformAdmin } from "@/lib/auth";
import { PlatformModeration } from "@/components/admin/platform-moderation";

export const metadata: Metadata = { title: "Moderation" };

export default async function PlatformModerationPage() {
  await requirePlatformAdmin(); // cross-tenant operator view — platform_admin role only (Stage 14)
  const flagged = await getComplianceFlags();
  return <PlatformModeration stores={flagged} />;
}
