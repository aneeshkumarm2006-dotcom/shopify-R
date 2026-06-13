"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { StoreStatus } from "@/types";
import type { PlatformSearchHit } from "@/types";
import {
  setStoreStatusBySubdomain,
  recordEvent,
  getStore,
  setErrorResolved,
  addStoreNote,
  deleteStoreNote,
  platformSearch,
} from "@/lib/data";
import { requirePlatformAdmin, getActorUserId } from "@/lib/auth";
import { mintImpersonation, clearImpersonation } from "@/lib/auth/impersonation";
import { getUserById } from "@/lib/data/account";

/**
 * Platform-admin server actions (Stage 14). Unlike the merchant actions, these are
 * cross-tenant, so EVERY entry point re-asserts `requirePlatformAdmin` server-side —
 * the action is a public endpoint and must never trust that the UI was only rendered
 * for an operator. Suspending a store flips `status: suspended`, which the storefront
 * resolver already refuses to serve (the store goes offline immediately); reinstating
 * returns it to `live`.
 */
export interface PlatformStatusResult {
  ok: boolean;
  status?: StoreStatus;
  error?: string;
}

export async function setStoreStatusAction(
  subdomain: string,
  status: StoreStatus,
): Promise<PlatformStatusResult> {
  await requirePlatformAdmin();
  try {
    const next = await setStoreStatusBySubdomain(subdomain, status);
    if (!next) return { ok: false, error: "Store not found." };
    // Only the operator suspend/reinstate transitions are audited here. The action
    // signature carries no suspension reason today (the UI collects but doesn't pass
    // one), so reason is intentionally absent from metadata.
    const eventType =
      next === "suspended"
        ? "store.suspended"
        : next === "live"
          ? "store.reinstated"
          : null;
    if (eventType) {
      await recordEvent({
        type: eventType,
        actorUserId: await getActorUserId(),
        actorType: "platform_admin",
        target: { kind: "store", label: subdomain },
      });
    }
    revalidatePath("/platform");
    return { ok: true, status: next };
  } catch {
    return { ok: false, error: "Couldn't update the store. Please try again." };
  }
}

/* ============================================================
   Operator impersonation (read-only v1). Every entry re-asserts platform_admin.
   ============================================================ */

export interface ImpersonationResult {
  ok: boolean;
  error?: string;
}

/**
 * Begin a read-only impersonation session for a store. Re-asserts `platform_admin`,
 * validates the store exists, REFUSES to impersonate a store owned by another
 * platform_admin (never act as an admin), mints the signed/time-boxed cookie, audits
 * the start, and lands the operator on the dashboard (now rendering the target store).
 */
export async function startImpersonation(storeId: string): Promise<ImpersonationResult> {
  await requirePlatformAdmin();
  const operatorId = await getActorUserId();
  if (!operatorId) return { ok: false, error: "Not signed in." };

  const store = await getStore(storeId);
  if (!store) return { ok: false, error: "Store not found." };

  const owner = await getUserById(store.ownerId);
  if (owner?.role === "platform_admin") {
    return { ok: false, error: "Can't impersonate a store owned by a platform admin." };
  }

  await mintImpersonation(storeId, operatorId);
  await recordEvent({
    type: "impersonation.started",
    storeId,
    actorUserId: operatorId,
    actorType: "platform_admin",
    target: { kind: "store", id: storeId, label: store.subdomain || store.name },
    metadata: { ownerId: store.ownerId },
  });
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

/** Mark an incident resolved / reopen it (operator triage). */
export async function resolveIncident(
  id: string,
  resolved: boolean,
): Promise<{ ok: boolean }> {
  await requirePlatformAdmin();
  const updated = await setErrorResolved(id, resolved);
  if (!updated) return { ok: false };
  revalidatePath("/platform/incidents");
  return { ok: true };
}

/* ----------------------------------------------- support notes + search --- */

export async function addStoreNoteAction(
  storeId: string,
  body: string,
): Promise<{ ok: boolean }> {
  await requirePlatformAdmin();
  const operatorId = await getActorUserId();
  const operator = operatorId ? await getUserById(operatorId) : null;
  const note = await addStoreNote(storeId, body, {
    id: operatorId,
    email: operator?.email ?? null,
  });
  if (!note) return { ok: false };
  revalidatePath(`/platform/stores/${storeId}`);
  return { ok: true };
}

export async function deleteStoreNoteAction(
  id: string,
  storeId: string,
): Promise<{ ok: boolean }> {
  await requirePlatformAdmin();
  const ok = await deleteStoreNote(id);
  if (ok) revalidatePath(`/platform/stores/${storeId}`);
  return { ok };
}

/** Global search across tenants (store/user/order/product) for the operator. */
export async function searchPlatform(query: string): Promise<PlatformSearchHit[]> {
  await requirePlatformAdmin();
  return platformSearch(query);
}

/** End the current impersonation session: audit, clear the cookie, back to the portal. */
export async function stopImpersonation(): Promise<void> {
  const operatorId = await getActorUserId();
  const { readImpersonation } = await import("@/lib/auth/impersonation");
  const active = await readImpersonation();
  if (active && active.operatorId === operatorId) {
    await recordEvent({
      type: "impersonation.ended",
      storeId: active.storeId,
      actorUserId: operatorId,
      actorType: "platform_admin",
      target: { kind: "store", id: active.storeId },
    });
  }
  await clearImpersonation();
  revalidatePath("/", "layout");
  redirect("/platform");
}
