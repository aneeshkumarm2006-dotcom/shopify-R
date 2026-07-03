import { createHash } from "node:crypto";

/**
 * Cloudinary signed-upload helper (Stage 9, PRD §8 — Cloudinary media).
 *
 * Server-only: reads the API secret and signs upload params with SHA-1, the
 * scheme Cloudinary's REST upload endpoint expects. We deliberately avoid the
 * `cloudinary` SDK — a signed upload only needs a hash, so a few lines of
 * `node:crypto` keep the dependency surface (and tsc memory) minimal, matching
 * the project's lean-deps stance.
 *
 * ### Graceful degradation
 * Mirrors `isDbConfigured()` / `isAuthConfigured()`: with the three Cloudinary
 * env vars unset, `isCloudinaryConfigured()` is false and the image dropzone
 * falls back to local object URLs (Part-A behaviour) so screens still work with
 * zero infrastructure. Set the env vars and real signed uploads take over with
 * no call-site changes.
 */

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;

/** True when a cloud name + API key/secret are all present. */
export function isCloudinaryConfigured(): boolean {
  return Boolean(CLOUD_NAME && API_KEY && API_SECRET);
}

/** Upload constraints baked INTO the signature so the browser can't widen them. */
export const UPLOAD_ALLOWED_FORMATS = "jpg,jpeg,png,webp,gif";
export const UPLOAD_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/** The signed params a browser needs to POST a file straight to Cloudinary. */
export interface UploadSignature {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  allowedFormats: string;
  maxFileSize: number;
}

/**
 * Build a SHA-1 signature for a direct (unsigned-by-the-browser, signed-by-us)
 * upload. Cloudinary signs the alphabetically-sorted, `&`-joined params that are
 * sent *besides* `file`/`api_key`/`resource_type`, with the API secret appended.
 * We sign `allowed_formats` + `folder` + `max_file_size` + `timestamp`, so the
 * browser can tamper with NONE of them without invalidating the signature — the
 * destination folder, the accepted image formats, and the size ceiling are all
 * enforced by Cloudinary as part of the signed request (not merely client-chosen).
 *
 * @param folder  Cloudinary folder to scope the asset to (e.g. a store id).
 * @param timestamp  Unix seconds; passed in so callers can mint it (scripts can't
 *   call `Date.now()` in some sandboxes, and tests stay deterministic).
 */
export function signUpload(folder: string, timestamp: number): UploadSignature {
  if (!isCloudinaryConfigured()) {
    throw new Error("Cloudinary is not configured (missing CLOUDINARY_* env vars).");
  }
  // Alphabetically-sorted param string is what Cloudinary expects for the signature.
  const toSign =
    `allowed_formats=${UPLOAD_ALLOWED_FORMATS}` +
    `&folder=${folder}` +
    `&max_file_size=${UPLOAD_MAX_FILE_SIZE}` +
    `&timestamp=${timestamp}`;
  const signature = createHash("sha1")
    .update(toSign + API_SECRET)
    .digest("hex");
  return {
    cloudName: CLOUD_NAME!,
    apiKey: API_KEY!,
    timestamp,
    signature,
    folder,
    allowedFormats: UPLOAD_ALLOWED_FORMATS,
    maxFileSize: UPLOAD_MAX_FILE_SIZE,
  };
}
