"use server";

import { revalidatePath } from "next/cache";
import type { StoreStatus } from "@/types";
import { publishStore, unpublishStore, PublishError } from "@/lib/data";
import { requireMerchantStoreId } from "@/lib/auth";

/**
 * Publish / unpublish actions (Stage 11, PRD §6.10). The `storeId` is resolved from
 * the session, so a merchant can only flip their own store. Publishing validates the
 * required pre-flight (subdomain claimed) in the data layer and stamps `publishedAt`;
 * unpublishing reverts to `draft`. Both revalidate every surface that shows store
 * status — the dashboard nudge/banner, the Publish screen, and Settings.
 */
export interface PublishResult {
  ok: boolean;
  status?: StoreStatus;
  error?: string;
}

function revalidateStatusSurfaces() {
  revalidatePath("/publish");
  revalidatePath("/dashboard");
  revalidatePath("/settings");
  revalidatePath("/preview");
}

export async function publishStoreAction(): Promise<PublishResult> {
  const storeId = await requireMerchantStoreId();
  try {
    const store = await publishStore(storeId);
    revalidateStatusSurfaces();
    return { ok: true, status: store.status };
  } catch (err) {
    if (err instanceof PublishError) return { ok: false, error: err.message };
    return { ok: false, error: "Couldn't publish the store. Please try again." };
  }
}

export async function unpublishStoreAction(): Promise<PublishResult> {
  const storeId = await requireMerchantStoreId();
  try {
    const store = await unpublishStore(storeId);
    revalidateStatusSurfaces();
    return { ok: true, status: store.status };
  } catch (err) {
    if (err instanceof PublishError) return { ok: false, error: err.message };
    return { ok: false, error: "Couldn't unpublish the store. Please try again." };
  }
}
