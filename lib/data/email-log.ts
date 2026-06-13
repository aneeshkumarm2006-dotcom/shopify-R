import type { EmailLogEntry, EmailStatus } from "@/types";
import { resolve } from "./_util";
import { isDbConfigured, dbConnect, serializeMany, EmailLogModel } from "@/lib/db";

/**
 * Email delivery log (operator comms log). `recordEmail` is fire-and-forget — called
 * by the email layer after each transactional send so the operator can answer "did
 * the customer's confirmation actually go out?". Imported DIRECTLY by `lib/email`
 * (not via the `@/lib/data` barrel) to avoid a checkout→email→data cycle.
 */

export interface RecordEmailInput {
  to: string;
  subject: string;
  kind: string;
  storeId?: string | null;
  status: EmailStatus;
  error?: string | null;
}

export async function recordEmail(input: RecordEmailInput): Promise<void> {
  if (!isDbConfigured()) return;
  try {
    await dbConnect();
    await EmailLogModel.create({
      to: input.to,
      subject: input.subject.slice(0, 500),
      kind: input.kind,
      storeId: input.storeId ?? null,
      status: input.status,
      error: input.error ? input.error.slice(0, 1000) : null,
    });
  } catch {
    /* logging must never break the send path */
  }
}

export interface EmailLogFilter {
  status?: EmailStatus;
  storeId?: string;
}

export async function getEmailLog(filter: EmailLogFilter = {}, limit = 100): Promise<EmailLogEntry[]> {
  if (!isDbConfigured()) return resolve([]);
  await dbConnect();
  const q: Record<string, unknown> = {};
  if (filter.status) q.status = filter.status;
  if (filter.storeId) q.storeId = filter.storeId;
  return serializeMany<EmailLogEntry>(
    await EmailLogModel.find(q).sort({ createdAt: -1 }).limit(limit).lean(),
  );
}
