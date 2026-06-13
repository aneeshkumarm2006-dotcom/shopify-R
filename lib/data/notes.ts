import type { StoreNote } from "@/types";
import { resolve } from "./_util";
import { isDbConfigured, dbConnect, serializeMany, serializeOrNull, StoreNoteModel } from "@/lib/db";

/**
 * Operator support notes pinned to a store (internal annotations / follow-up trail).
 * Operator-only (gated by `requirePlatformAdmin` at the call site).
 */

export async function getStoreNotes(storeId: string, limit = 50): Promise<StoreNote[]> {
  if (!isDbConfigured()) return resolve([]);
  await dbConnect();
  return serializeMany<StoreNote>(
    await StoreNoteModel.find({ storeId }).sort({ createdAt: -1 }).limit(limit).lean(),
  );
}

export async function addStoreNote(
  storeId: string,
  body: string,
  author: { id?: string | null; email?: string | null },
): Promise<StoreNote | null> {
  const text = body.trim();
  if (!isDbConfigured() || !text) return null;
  await dbConnect();
  return serializeOrNull<StoreNote>(
    await StoreNoteModel.create({
      storeId,
      body: text.slice(0, 4000),
      authorId: author.id ?? null,
      authorEmail: author.email ?? null,
    }).then((d) => d.toObject()),
  );
}

export async function deleteStoreNote(id: string): Promise<boolean> {
  if (!isDbConfigured()) return false;
  await dbConnect();
  const res = await StoreNoteModel.deleteOne({ _id: id });
  return (res.deletedCount ?? 0) > 0;
}
