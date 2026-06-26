"use server";

import { revalidatePath } from "next/cache";
import type { StoreRole } from "@/types";
import {
  inviteStoreMember,
  updateMemberRole,
  removeStoreMember,
  StaffError,
  recordEvent,
} from "@/lib/data";
import {
  requirePermission,
  assertNotImpersonating,
  getActorUserId,
  PermissionError,
} from "@/lib/auth";

/**
 * Staff management actions (Phase 6 RBAC). Gated by the `staff` permission, which only
 * the store owner holds — so admins/staff can't escalate. storeId resolves server-side.
 */

type Role = Exclude<StoreRole, "owner">;

/** Resolve the owner-gated storeId, mapping the two refusal modes to friendly copy. */
async function authorize(): Promise<{ storeId?: string; error?: string }> {
  try {
    const storeId = await requirePermission("staff");
    await assertNotImpersonating();
    return { storeId };
  } catch (err) {
    if (err instanceof PermissionError) return { error: "Only the store owner can manage staff." };
    return { error: "Read-only: exit impersonation to make changes." };
  }
}

export async function inviteMemberAction(
  email: string,
  role: Role,
): Promise<{ ok: boolean; error?: string }> {
  const { storeId, error } = await authorize();
  if (!storeId) return { ok: false, error };
  try {
    const member = await inviteStoreMember(storeId, email, role);
    await recordEvent({
      type: "staff.invited",
      storeId,
      actorUserId: await getActorUserId(),
      target: { kind: "user", id: member._id, label: member.email },
      metadata: { role },
    });
    revalidatePath("/staff");
    return { ok: true };
  } catch (err) {
    if (err instanceof StaffError) return { ok: false, error: err.message };
    return { ok: false, error: "Couldn't add the member." };
  }
}

export async function updateMemberRoleAction(
  id: string,
  role: Role,
): Promise<{ ok: boolean; error?: string }> {
  const { storeId, error } = await authorize();
  if (!storeId) return { ok: false, error };
  const updated = await updateMemberRole(storeId, id, role);
  if (!updated) return { ok: false, error: "Member not found." };
  await recordEvent({
    type: "staff.role_changed",
    storeId,
    actorUserId: await getActorUserId(),
    target: { kind: "user", id, label: updated.email },
    metadata: { role },
  });
  revalidatePath("/staff");
  return { ok: true };
}

export async function removeMemberAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const { storeId, error } = await authorize();
  if (!storeId) return { ok: false, error };
  const ok = await removeStoreMember(storeId, id);
  if (ok) {
    await recordEvent({
      type: "staff.removed",
      storeId,
      actorUserId: await getActorUserId(),
      target: { kind: "user", id },
    });
    revalidatePath("/staff");
  }
  return { ok };
}
