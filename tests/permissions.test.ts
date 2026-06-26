import { test } from "node:test";
import assert from "node:assert/strict";
import {
  roleHasPermission,
  permissionsForRole,
  canManageRole,
  ROLE_PERMISSIONS,
} from "@/lib/auth/permissions";

/** RBAC matrix (Phase 6) — the access rules staff/admin/owner roles grant. */

test("owner has every permission", () => {
  assert.ok(roleHasPermission("owner", "staff"));
  assert.ok(roleHasPermission("owner", "settings"));
  assert.ok(roleHasPermission("owner", "publish"));
});

test("admin runs the store but can't manage staff", () => {
  assert.ok(roleHasPermission("admin", "settings"));
  assert.ok(roleHasPermission("admin", "marketing"));
  assert.ok(roleHasPermission("admin", "publish"));
  assert.ok(!roleHasPermission("admin", "staff"));
});

test("staff is limited to day-to-day catalog/orders", () => {
  assert.ok(roleHasPermission("staff", "products"));
  assert.ok(roleHasPermission("staff", "orders"));
  assert.ok(roleHasPermission("staff", "analytics"));
  assert.ok(!roleHasPermission("staff", "settings"));
  assert.ok(!roleHasPermission("staff", "discounts"));
  assert.ok(!roleHasPermission("staff", "staff"));
});

test("a null role (no access) grants nothing", () => {
  assert.ok(!roleHasPermission(null, "products"));
  assert.deepEqual(permissionsForRole(null), []);
});

test("only owners can assign roles, and never another owner", () => {
  assert.ok(canManageRole("owner", "admin"));
  assert.ok(canManageRole("owner", "staff"));
  assert.ok(!canManageRole("admin", "staff"));
  assert.ok(!canManageRole("staff", "staff"));
  assert.ok(!canManageRole("owner", "owner" as never));
});

test("admin permissions are a strict subset of owner's", () => {
  for (const p of ROLE_PERMISSIONS.admin) {
    assert.ok(ROLE_PERMISSIONS.owner.includes(p));
  }
  assert.ok(ROLE_PERMISSIONS.admin.length < ROLE_PERMISSIONS.owner.length);
});
