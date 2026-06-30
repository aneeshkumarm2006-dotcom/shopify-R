import type {
  CustomDomain,
  DomainSslStatus,
  DomainVerificationChallenge,
  DomainVerificationStatus,
} from "@/types";
import { isDbConfigured, dbConnect, serialize, serializeMany, CustomDomainModel } from "@/lib/db";

/**
 * Custom-domain data layer (Phase 6+, step 1). DB-only: routing, Vercel API
 * integration, and the cron sweep / Edge Config sync live in separate phases
 * that call into these functions. `domain` is globally unique across the
 * platform (DB-enforced on `CustomDomainSchema`) — a domain belongs to exactly
 * one store, ever; ownership checks below always scope by `storeId` together
 * with `_id` so one merchant can never read/mutate another's domain row.
 */

/** Thrown for domain conflicts (already claimed, not found, not eligible to be primary, etc.). */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

/** All domains for a store, oldest first. */
export async function listDomainsForStore(storeId: string): Promise<CustomDomain[]> {
  if (!isDbConfigured()) return [];
  await dbConnect();
  return serializeMany<CustomDomain>(
    await CustomDomainModel.find({ storeId }).sort({ createdAt: 1 }).lean(),
  );
}

/** A single domain, ownership-scoped: filters by `_id` AND `storeId` together. */
export async function getDomainById(storeId: string, domainId: string): Promise<CustomDomain | null> {
  if (!isDbConfigured()) return null;
  await dbConnect();
  const doc = await CustomDomainModel.findOne({ _id: domainId, storeId }).lean();
  return doc ? serialize<CustomDomain>(doc) : null;
}

/**
 * Hot lookup for the (separately-built) cron job that syncs verified domains into
 * an Edge Config routing cache. Not used by request-time routing directly, so this
 * just needs to be correct, not blazing fast.
 */
export async function getStoreIdByVerifiedDomain(domain: string): Promise<string | null> {
  if (!isDbConfigured()) return null;
  await dbConnect();
  const clean = domain.trim().toLowerCase();
  if (!clean) return null;
  const doc = await CustomDomainModel.findOne({
    domain: clean,
    verificationStatus: "verified",
  }).lean<{ storeId?: string } | null>();
  return doc?.storeId ?? null;
}

/**
 * Start connecting a domain to a store. Idempotent: if this exact (storeId, domain)
 * row already exists, returns it as-is instead of erroring. If the domain is already
 * claimed by a DIFFERENT store, the unique index rejects the insert (code 11000) and
 * we surface a friendly `DomainError`.
 */
export async function createPendingDomain(
  storeId: string,
  domain: string,
  isApex: boolean,
  addedBy?: string,
): Promise<CustomDomain> {
  if (!isDbConfigured()) throw new DomainError("Custom domains need a database connection.");
  const clean = domain.trim().toLowerCase();
  if (!clean) throw new DomainError("Enter a domain.");

  await dbConnect();

  // Idempotent re-add: this store already owns this domain — no-op success.
  const existing = await CustomDomainModel.findOne({ storeId, domain: clean }).lean();
  if (existing) return serialize<CustomDomain>(existing);

  try {
    const doc = await CustomDomainModel.create({
      storeId,
      domain: clean,
      isApex,
      isPrimary: false,
      verificationStatus: "pending",
      sslStatus: "pending",
      verificationDetails: [],
      addedBy: addedBy ?? null,
    });
    return serialize<CustomDomain>(doc.toObject());
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && (err as { code: number }).code === 11000) {
      throw new DomainError("This domain is already connected to a store.");
    }
    throw err instanceof Error ? err : new DomainError("Couldn't add the domain.");
  }
}

/**
 * Apply a verification/SSL status update (called by the separately-built Vercel
 * status-check code after polling Vercel). Always stamps `lastCheckedAt`.
 */
export async function updateDomainVerification(
  domainId: string,
  update: {
    verificationStatus?: DomainVerificationStatus;
    verificationDetails?: DomainVerificationChallenge[];
    sslStatus?: DomainSslStatus;
    errorMessage?: string | null;
  },
): Promise<CustomDomain | null> {
  if (!isDbConfigured()) return null;
  await dbConnect();
  const updated = await CustomDomainModel.findOneAndUpdate(
    { _id: domainId },
    { $set: { ...update, lastCheckedAt: new Date() } },
    { new: true },
  ).lean();
  return updated ? serialize<CustomDomain>(updated) : null;
}

/**
 * Promote a domain to primary for its store. Throws if the domain isn't owned by
 * `storeId` or isn't verified. Unsets any existing primary first, then sets the
 * target — two sequential ops; the partial unique index on `{storeId, isPrimary}`
 * is the safety net against a race producing two primaries, not a substitute for
 * doing this in the right order.
 */
export async function setPrimaryDomain(storeId: string, domainId: string): Promise<CustomDomain> {
  if (!isDbConfigured()) throw new DomainError("Custom domains need a database connection.");
  await dbConnect();

  const target = await CustomDomainModel.findOne({ _id: domainId, storeId }).lean<{
    verificationStatus?: DomainVerificationStatus;
  } | null>();
  if (!target) throw new DomainError("Domain not found.");
  if (target.verificationStatus !== "verified") {
    throw new DomainError("Verify this domain before making it primary.");
  }

  await CustomDomainModel.updateMany({ storeId, isPrimary: true }, { $set: { isPrimary: false } });
  const updated = await CustomDomainModel.findOneAndUpdate(
    { _id: domainId, storeId },
    { $set: { isPrimary: true } },
    { new: true },
  ).lean();
  if (!updated) throw new DomainError("Domain not found.");
  return serialize<CustomDomain>(updated);
}

/**
 * Remove a domain (ownership-scoped). The Vercel-side DELETE call happens in a
 * different layer that calls this — DB-only here.
 */
export async function removeDomain(storeId: string, domainId: string): Promise<boolean> {
  if (!isDbConfigured()) return false;
  await dbConnect();
  const res = await CustomDomainModel.deleteOne({ _id: domainId, storeId });
  return res.deletedCount > 0;
}

/**
 * Domains pending verification that haven't been checked recently (or ever), for
 * the (separately-built) cron sweep.
 */
export async function listPendingDomainsForSweep(olderThanMinutes: number): Promise<CustomDomain[]> {
  if (!isDbConfigured()) return [];
  await dbConnect();
  const cutoff = new Date(Date.now() - olderThanMinutes * 60_000);
  return serializeMany<CustomDomain>(
    await CustomDomainModel.find({
      verificationStatus: "pending",
      $or: [{ lastCheckedAt: { $exists: false } }, { lastCheckedAt: { $lt: cutoff } }],
    })
      .sort({ lastCheckedAt: 1 })
      .lean(),
  );
}
