"use server";

import { revalidatePath } from "next/cache";
import type { StoreStatus } from "@/types";
import { setStoreStatusBySubdomain } from "@/lib/data";
import { requirePlatformAdmin } from "@/lib/auth";

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
    revalidatePath("/platform");
    return { ok: true, status: next };
  } catch {
    return { ok: false, error: "Couldn't update the store. Please try again." };
  }
}
