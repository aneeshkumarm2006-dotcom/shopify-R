import type { PlatformUserSummary } from "@/types";
import { Eyebrow, PageHeader, Pill, type PillTone } from "@/components/ui";

/**
 * Platform operator Users (Stage 14, DESIGN §4.12) — the cross-tenant account list:
 * email · name · role · store count · effective plan. Read-only; uses the shared
 * `.tbl` table styling so it reads like every other admin index.
 */

const ROLE_TONE: Record<PlatformUserSummary["role"], PillTone> = {
  platform_admin: "info",
  merchant: "muted",
};

const ROLE_LABEL: Record<PlatformUserSummary["role"], string> = {
  platform_admin: "Operator",
  merchant: "Merchant",
};

export function PlatformUsers({ users }: { users: PlatformUserSummary[] }) {
  return (
    <div>
      <PageHeader
        title="Users"
        meta="Cross-tenant account list — read-only."
      />

      <div style={{ marginBottom: "var(--space-3)" }}>
        <Eyebrow>
          {users.length} {users.length === 1 ? "user" : "users"}
        </Eyebrow>
      </div>

      {users.length === 0 ? (
        <div
          className="card"
          style={{
            padding: "var(--space-6) var(--space-5)",
            textAlign: "center",
            color: "var(--text-muted)",
            fontSize: "var(--text-sm)",
          }}
        >
          No users yet.
        </div>
      ) : (
        <div className="card" style={{ overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Email</th>
                  <th scope="col">Name</th>
                  <th scope="col">Role</th>
                  <th scope="col" style={{ textAlign: "right" }}>
                    Stores
                  </th>
                  <th scope="col">Plan</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <span className="mono" style={{ color: "var(--text-strong)" }}>
                        {u.email}
                      </span>
                    </td>
                    <td>{u.name}</td>
                    <td>
                      <Pill tone={ROLE_TONE[u.role]} dot={false}>
                        {ROLE_LABEL[u.role]}
                      </Pill>
                    </td>
                    <td className="mono" style={{ textAlign: "right" }}>
                      {u.storeCount}
                    </td>
                    <td>
                      <span style={{ textTransform: "capitalize" }}>{u.plan}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
