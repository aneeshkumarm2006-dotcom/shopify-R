import type { Metadata } from "next";
import { getPlatformUsers } from "@/lib/data";
import { requirePlatformAdmin } from "@/lib/auth";
import { PlatformUsers } from "@/components/admin/platform-users";

export const metadata: Metadata = { title: "Users" };

export default async function PlatformUsersPage() {
  await requirePlatformAdmin(); // cross-tenant operator view — platform_admin role only (Stage 14)
  const users = await getPlatformUsers();
  return <PlatformUsers users={users} />;
}
