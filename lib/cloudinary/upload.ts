"use client";

import { getUploadSignature } from "./actions";

/**
 * Browser-side uploader used by the image dropzone (Stage 9). Fetches a signed
 * param set from the server action, then streams the file straight to
 * Cloudinary's REST endpoint and returns the resulting `secure_url`.
 *
 * Returns `null` when Cloudinary is unconfigured (no signature) so the caller can
 * fall back to a local object URL — the dropzone keeps working with no infra.
 */
export async function uploadToCloudinary(file: File): Promise<string | null> {
  const sig = await getUploadSignature();
  if (!sig) return null;

  const body = new FormData();
  body.append("file", file);
  body.append("api_key", sig.apiKey);
  body.append("timestamp", String(sig.timestamp));
  body.append("signature", sig.signature);
  body.append("folder", sig.folder);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`,
    { method: "POST", body },
  );
  if (!res.ok) {
    throw new Error(`Cloudinary upload failed (${res.status})`);
  }
  const json = (await res.json()) as { secure_url?: string };
  if (!json.secure_url) throw new Error("Cloudinary upload returned no URL.");
  return json.secure_url;
}
