import type { StoreMember, StoreRole } from "@/types";
import {
  isDbConfigured,
  dbConnect,
  serialize,
  serializeMany,
  StoreMemberModel,
  StoreModel,
  UserModel,
} from "@/lib/db";

/**
 * Staff & RBAC data layer (Phase 6). A store's `ownerId` user is always the owner;
 * additional users are `StoreMember` rows (admin/staff) keyed by email. An invitation
 * is a member with `status: "invited"` and no `userId`; it links + activates the first
 * time that email signs in (see `linkAndListMemberStores`). All membership reads are
 * email/userId-scoped, so a member can only ever reach a store they were added to (§9).
 */

/** Thrown for invite conflicts (already a member, or the store owner). */
export class StaffError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StaffError";
  }
}

/** All members of a store, owner first (the owner is synthesized, not stored). */
export async function listStoreMembers(storeId: string): Promise<StoreMember[]> {
  if (!isDbConfigured()) return [];
  await dbConnect();
  const members = serializeMany<StoreMember>(
    await StoreMemberModel.find({ storeId }).sort({ createdAt: 1 }).lean(),
  );
  const store = await StoreModel.findById(storeId).lean<{ ownerId?: string; createdAt?: Date } | null>();
  if (!store?.ownerId) return members;
  const owner = await UserModel.findById(store.ownerId).lean<{ email?: string; name?: string } | null>();
  const at = new Date().toISOString();
  const ownerRow: StoreMember = {
    _id: `owner:${store.ownerId}`,
    storeId,
    email: owner?.email ?? "",
    userId: store.ownerId,
    name: owner?.name ?? "",
    role: "owner",
    status: "active",
    createdAt: at,
    updatedAt: at,
  };
  return [ownerRow, ...members];
}

/** Invite a user (by email) as admin/staff. Activates immediately if they already exist. */
export async function inviteStoreMember(
  storeId: string,
  email: string,
  role: Exclude<StoreRole, "owner">,
): Promise<StoreMember> {
  if (!isDbConfigured()) throw new StaffError("Staff management needs a database connection.");
  const clean = email.trim().toLowerCase();
  if (!clean) throw new StaffError("Enter an email address.");

  await dbConnect();
  const store = await StoreModel.findById(storeId).lean<{ ownerId?: string } | null>();
  if (store?.ownerId) {
    const owner = await UserModel.findById(store.ownerId).lean<{ email?: string } | null>();
    if (owner?.email?.toLowerCase() === clean) throw new StaffError("That's the store owner.");
  }

  // If the invitee already has an account, link + activate right away.
  const user = await UserModel.findOne({ email: clean }).lean<{ _id: string; name?: string } | null>();
  try {
    const doc = await StoreMemberModel.create({
      storeId,
      email: clean,
      role,
      userId: user?._id ?? null,
      name: user?.name ?? "",
      status: user ? "active" : "invited",
    });
    return serialize<StoreMember>(doc.toObject());
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && (err as { code: number }).code === 11000) {
      throw new StaffError("That person is already a member.");
    }
    throw err instanceof Error ? err : new StaffError("Couldn't add the member.");
  }
}

export async function updateMemberRole(
  storeId: string,
  memberId: string,
  role: Exclude<StoreRole, "owner">,
): Promise<StoreMember | null> {
  if (!isDbConfigured()) return null;
  await dbConnect();
  const updated = await StoreMemberModel.findOneAndUpdate(
    { _id: memberId, storeId },
    { $set: { role } },
    { new: true },
  ).lean();
  return updated ? serialize<StoreMember>(updated) : null;
}

export async function removeStoreMember(storeId: string, memberId: string): Promise<boolean> {
  if (!isDbConfigured()) return false;
  await dbConnect();
  const res = await StoreMemberModel.deleteOne({ _id: memberId, storeId });
  return res.deletedCount > 0;
}

/**
 * The role a user holds on a store: `owner` (matches `Store.ownerId`), the member role,
 * or null when they have no access. The single authority the permission guard reads.
 */
export async function getStoreRole(
  storeId: string,
  userId: string,
  email?: string | null,
): Promise<StoreRole | null> {
  if (!isDbConfigured()) return "owner"; // stub mode: single demo merchant owns everything
  await dbConnect();
  const store = await StoreModel.findById(storeId).lean<{ ownerId?: string } | null>();
  if (!store) return null;
  if (store.ownerId === userId) return "owner";

  const or: Record<string, unknown>[] = [{ userId }];
  if (email) or.push({ email: email.trim().toLowerCase() });
  const member = await StoreMemberModel.findOne({ storeId, status: "active", $or: or }).lean<{
    role?: StoreRole;
  } | null>();
  return member?.role ?? null;
}

/**
 * Activate any pending invitations for this email, then return the store ids the user
 * can access as a member. Called from `resolveActiveStore`/`getAccessibleStores` so a
 * staff user's stores show up the moment they sign in.
 */
export async function linkAndListMemberStores(userId: string, email: string): Promise<string[]> {
  if (!isDbConfigured()) return [];
  await dbConnect();
  const clean = email.trim().toLowerCase();
  if (clean) {
    await StoreMemberModel.updateMany(
      { email: clean, userId: null },
      { $set: { userId, status: "active" } },
    );
  }
  const or: Record<string, unknown>[] = [{ userId }];
  if (clean) or.push({ email: clean });
  const rows = await StoreMemberModel.find({ status: "active", $or: or })
    .select("storeId")
    .lean<{ storeId: string }[]>();
  return [...new Set(rows.map((r) => r.storeId))];
}
