"use server";

import { revalidatePath } from "next/cache";
import {
  createLocation,
  renameLocation,
  setDefaultLocation,
  deleteLocation,
  setInventoryLevel,
  recordEvent,
} from "@/lib/data";
import { requirePermission, assertNotImpersonating, getActorUserId } from "@/lib/auth";

/**
 * Locations + per-location stock actions (Phase 6). storeId resolves server-side. Stock
 * edits flow through `setInventoryLevel`, which keeps the sellable aggregate in sync.
 */

function revalidate() {
  revalidatePath("/locations");
  revalidatePath("/inventory");
}

export async function createLocationAction(name: string): Promise<{ ok: boolean; error?: string }> {
  const storeId = await requirePermission("settings");
  try { await assertNotImpersonating(); } catch { return { ok: false, error: "Read-only: exit impersonation to make changes." }; }
  const loc = await createLocation(storeId, name);
  if (!loc) return { ok: false, error: "Couldn't create the location." };
  await recordEvent({
    type: "location.created",
    storeId,
    actorUserId: await getActorUserId(),
    target: { kind: "location", id: loc._id, label: loc.name },
  });
  revalidate();
  return { ok: true };
}

export async function renameLocationAction(id: string, name: string): Promise<{ ok: boolean }> {
  const storeId = await requirePermission("settings");
  try { await assertNotImpersonating(); } catch { return { ok: false }; }
  const ok = Boolean(await renameLocation(storeId, id, name));
  if (ok) revalidate();
  return { ok };
}

export async function setDefaultLocationAction(id: string): Promise<{ ok: boolean }> {
  const storeId = await requirePermission("settings");
  try { await assertNotImpersonating(); } catch { return { ok: false }; }
  const ok = await setDefaultLocation(storeId, id);
  if (ok) revalidate();
  return { ok };
}

export async function deleteLocationAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const storeId = await requirePermission("settings");
  try { await assertNotImpersonating(); } catch { return { ok: false, error: "Read-only: exit impersonation to make changes." }; }
  const res = await deleteLocation(storeId, id);
  if (res.ok) {
    await recordEvent({ type: "location.deleted", storeId, actorUserId: await getActorUserId(), target: { kind: "location", id } });
    revalidate();
  }
  return res;
}

/** Set the stock for a (variant, location). Returns the new sellable total. */
export async function setInventoryLevelAction(input: {
  productId: string;
  variantId: string;
  locationId: string;
  quantity: number;
}): Promise<{ ok: boolean; total?: number }> {
  const storeId = await requirePermission("settings");
  try { await assertNotImpersonating(); } catch { return { ok: false }; }
  const total = await setInventoryLevel(storeId, input);
  if (total === null) return { ok: false };
  revalidate();
  return { ok: true, total };
}
