import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listStoreMembers } from "@/lib/data";
import { requireMerchantStoreId, getCurrentStoreRole } from "@/lib/auth";
import { StaffAdmin } from "@/components/admin/staff";

export const metadata: Metadata = { title: "Staff" };

/**
 * Staff & permissions (Phase 6 RBAC). Only the owner can manage members; admins/staff
 * see the roster read-only. The `staff` permission is owner-only, so a non-owner who
 * navigates here gets a read-only view (mutations are also blocked server-side).
 */
export default async function StaffPage() {
  const storeId = await requireMerchantStoreId();
  const [members, role] = await Promise.all([listStoreMembers(storeId), getCurrentStoreRole()]);
  if (!role) notFound();
  return <StaffAdmin members={members} canManage={role === "owner"} />;
}
