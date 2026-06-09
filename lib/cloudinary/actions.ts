"use server";

import { requireMerchantStoreId } from "@/lib/auth";
import { isCloudinaryConfigured, signUpload, type UploadSignature } from "./index";

/**
 * Server action backing the image dropzone's signed uploads. The browser asks
 * for a fresh signature, then POSTs the file directly to Cloudinary — bytes never
 * touch our server. The destination folder is forced to the signed-in merchant's
 * store id (tenant-scoped media, PRD §9), so a client can't redirect uploads into
 * another tenant's folder.
 *
 * Returns `null` when Cloudinary is unconfigured, signalling the dropzone to fall
 * back to local object URLs (Part-A behaviour).
 */
export async function getUploadSignature(): Promise<UploadSignature | null> {
  if (!isCloudinaryConfigured()) return null;
  const storeId = await requireMerchantStoreId();
  const timestamp = Math.floor(Date.now() / 1000);
  return signUpload(`offshelf/${storeId}`, timestamp);
}
