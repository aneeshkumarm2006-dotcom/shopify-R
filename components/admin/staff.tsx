"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { StoreMember, StoreRole } from "@/types";
import {
  Avatar,
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Pill,
  useToast,
} from "@/components/ui";
import { permissionsForRole } from "@/lib/auth/permissions";
import { fmtDate } from "@/lib/format";
import {
  inviteMemberAction,
  updateMemberRoleAction,
  removeMemberAction,
} from "@/app/(admin)/staff/actions";

const ROLE_LABEL: Record<StoreRole, string> = { owner: "Owner", admin: "Admin", staff: "Staff" };

/**
 * Staff & permissions admin (Phase 6 RBAC). Owners invite members (admin/staff), change
 * roles, and remove them; non-owners see a read-only roster. Server actions re-check the
 * owner-only `staff` permission, so the read-only UI is a convenience, not the guard.
 */
export function StaffAdmin({
  members,
  canManage,
}: {
  members: StoreMember[];
  canManage: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Exclude<StoreRole, "owner">>("staff");

  function invite() {
    if (!email.trim()) return;
    startTransition(async () => {
      const res = await inviteMemberAction(email.trim(), role);
      if (!res.ok) {
        toast(res.error ?? "Couldn't add the member", { tone: "critical" });
        return;
      }
      setEmail("");
      toast("Member added");
      router.refresh();
    });
  }
  function changeRole(id: string, next: Exclude<StoreRole, "owner">) {
    startTransition(async () => {
      const res = await updateMemberRoleAction(id, next);
      if (!res.ok) toast(res.error ?? "Couldn't update", { tone: "critical" });
      else {
        toast("Role updated");
        router.refresh();
      }
    });
  }
  function remove(id: string) {
    startTransition(async () => {
      const res = await removeMemberAction(id);
      if (!res.ok) toast(res.error ?? "Couldn't remove", { tone: "critical" });
      else {
        toast("Member removed");
        router.refresh();
      }
    });
  }

  return (
    <div>
      <PageHeader title="Staff" />

      {canManage && (
        <Card title="Add a member" style={{ marginBottom: "var(--space-5)" }}>
          <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <Field label="Email">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="teammate@example.com"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      invite();
                    }
                  }}
                />
              </Field>
            </div>
            <Field label="Role">
              <select
                className="input"
                value={role}
                onChange={(e) => setRole(e.target.value as Exclude<StoreRole, "owner">)}
              >
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
            </Field>
            <Button variant="primary" onClick={invite} loading={pending} disabled={!email.trim()}>
              Add
            </Button>
          </div>
          <p style={{ marginTop: "var(--space-3)", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
            <b>Admin</b>: full access except staff management. <b>Staff</b>:{" "}
            {permissionsForRole("staff").join(", ")}.
          </p>
        </Card>
      )}

      <Card title="Members" pad={false}>
        <table className="tbl">
          <thead>
            <tr>
              <th scope="col">Member</th>
              <th scope="col">Role</th>
              <th scope="col">Status</th>
              <th scope="col">Added</th>
              {canManage && <th scope="col" style={{ width: 180 }} aria-label="Actions" />}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const isOwner = m.role === "owner";
              return (
                <tr key={m._id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Avatar name={m.name || m.email} size={30} />
                      <div>
                        <div style={{ fontWeight: 500, color: "var(--text-strong)" }}>
                          {m.name || m.email}
                        </div>
                        {m.name && (
                          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>{m.email}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <Pill tone={isOwner ? "info" : "muted"}>{ROLE_LABEL[m.role]}</Pill>
                  </td>
                  <td>
                    {m.status === "invited" ? (
                      <Pill tone="warning">Invited</Pill>
                    ) : (
                      <Pill tone="success">Active</Pill>
                    )}
                  </td>
                  <td style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>
                    {fmtDate(m.createdAt)}
                  </td>
                  {canManage && (
                    <td className="col-right">
                      {isOwner ? (
                        <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>—</span>
                      ) : (
                        <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                          <select
                            className="input"
                            value={m.role}
                            disabled={pending}
                            onChange={(e) => changeRole(m._id, e.target.value as Exclude<StoreRole, "owner">)}
                            style={{ width: 90, padding: "4px 6px" }}
                          >
                            <option value="staff">Staff</option>
                            <option value="admin">Admin</option>
                          </select>
                          <Button size="sm" variant="ghost" icon="trash" aria-label="Remove" onClick={() => remove(m._id)} />
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
