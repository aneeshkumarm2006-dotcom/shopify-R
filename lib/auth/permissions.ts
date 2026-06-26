import type { Permission, StoreRole } from "@/types";

/**
 * Role-based access control matrix (Phase 6) — pure + dependency-free so it's
 * unit-tested and importable anywhere (server guards + client nav gating). The
 * store owner is always `owner` (full access); `admin` runs the store but can't
 * manage other members; `staff` handles day-to-day catalog/orders only.
 */

export const ALL_PERMISSIONS: Permission[] = [
  "products",
  "orders",
  "customers",
  "discounts",
  "marketing",
  "content",
  "analytics",
  "settings",
  "publish",
  "staff",
];

const STAFF_PERMISSIONS: Permission[] = ["products", "orders", "customers", "content", "analytics"];

/** Permissions granted to each role. */
export const ROLE_PERMISSIONS: Record<StoreRole, Permission[]> = {
  owner: ALL_PERMISSIONS,
  // Admin runs everything except managing staff (owner-only).
  admin: ALL_PERMISSIONS.filter((p) => p !== "staff"),
  staff: STAFF_PERMISSIONS,
};

/** Does a role grant a permission? A null role (no access) grants nothing. */
export function roleHasPermission(role: StoreRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

/** All permissions for a role (for client-side nav gating). */
export function permissionsForRole(role: StoreRole | null | undefined): Permission[] {
  return role ? ROLE_PERMISSIONS[role] : [];
}

/** Can `actor` assign/modify the `target` role? Only owners manage staff, and no one
 *  can create another owner through the staff UI (ownership transfer is out of scope). */
export function canManageRole(actorRole: StoreRole | null | undefined, targetRole: StoreRole): boolean {
  if (actorRole !== "owner") return false;
  return targetRole === "admin" || targetRole === "staff";
}
