"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Page } from "@/types";
import {
  Button,
  Dropdown,
  EmptyState,
  IconButton,
  MenuItem,
  MenuSeparator,
  NoResultsState,
  PageHeader,
  Pill,
  useToast,
  useConfirm,
} from "@/components/ui";
import { IndexShell } from "@/components/admin/index-shell";
import { removePage } from "@/app/(admin)/pages/actions";
import { storeOrigin } from "@/lib/format";

/**
 * Content-pages index (Online Store → Pages). Lists each merchant-authored page with
 * title · handle · visibility, plus a per-row menu (edit / view / delete). Row → page
 * editor. This is the CMS the platform previously lacked entirely.
 */
export function PagesIndex({ pages, storeSubdomain }: { pages: Page[]; storeSubdomain?: string }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pages;
    return pages.filter(
      (p) => p.title.toLowerCase().includes(q) || p.handle.toLowerCase().includes(q),
    );
  }, [pages, query]);

  const viewUrl = (handle: string) =>
    storeSubdomain ? `${storeOrigin(storeSubdomain)}/pages/${handle}` : null;

  async function destroy(id: string, close: () => void) {
    close();
    const p = pages.find((x) => x._id === id);
    const ok = await confirm({
      title: "Delete page?",
      message: `${p ? `“${p.title}”` : "This page"} will be permanently deleted. This can’t be undone.`,
      confirmLabel: "Delete page",
      destructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await removePage(id);
      if (!res.ok) {
        toast("Couldn't delete the page", { tone: "critical" });
        return;
      }
      toast("Page deleted");
      router.refresh();
    });
  }

  return (
    <div>
      <PageHeader
        breadcrumb={
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            style={{ padding: "0 6px", marginLeft: -6, color: "var(--text-muted)" }}
            onClick={() => router.push("/builder")}
          >
            Online Store
          </button>
        }
        title="Pages"
        actions={
          <Button variant="primary" icon="plus" onClick={() => router.push("/pages/new")}>
            Add page
          </Button>
        }
      />

      {pages.length === 0 ? (
        <EmptyState
          icon="type"
          title="No pages yet"
          body="Create content pages like About, Contact, or FAQ, then link them from your header or footer."
          action={
            <Button variant="primary" icon="plus" onClick={() => router.push("/pages/new")}>
              Add page
            </Button>
          }
        />
      ) : (
        <IndexShell
          tabsLabel="Pages"
          tabs={[{ value: "All", label: "All", count: pages.length }]}
          active="All"
          onTabChange={() => {}}
          query={query}
          onQueryChange={setQuery}
          searchPlaceholder="Search pages"
        >
          {rows.length === 0 ? (
            <NoResultsState onClear={() => setQuery("")} />
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Title</th>
                  <th scope="col">Handle</th>
                  <th scope="col">Visibility</th>
                  <th scope="col" style={{ width: 44 }} aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr
                    key={p._id}
                    className="is-clickable"
                    onClick={() => router.push(`/pages/edit/${p._id}`)}
                  >
                    <td>
                      <span style={{ fontWeight: 500, color: "var(--text-strong)" }}>{p.title}</span>
                    </td>
                    <td>
                      <span className="mono" style={{ color: "var(--text-muted)" }}>
                        /pages/{p.handle}
                      </span>
                    </td>
                    <td>
                      {p.status === "visible" ? (
                        <Pill tone="success">Visible</Pill>
                      ) : (
                        <Pill tone="muted">Hidden</Pill>
                      )}
                    </td>
                    <td className="col-check" onClick={(e) => e.stopPropagation()}>
                      <Dropdown
                        trigger={<IconButton name="dots" size={28} aria-label={`Actions for ${p.title}`} />}
                      >
                        {(close) => (
                          <>
                            <MenuItem
                              icon="eye"
                              onClick={() => {
                                router.push(`/pages/edit/${p._id}`);
                                close();
                              }}
                            >
                              Edit
                            </MenuItem>
                            {p.status === "visible" && viewUrl(p.handle) && (
                              <MenuItem
                                icon="external"
                                onClick={() => {
                                  window.open(viewUrl(p.handle)!, "_blank", "noopener");
                                  close();
                                }}
                              >
                                View on store
                              </MenuItem>
                            )}
                            <MenuSeparator />
                            <MenuItem icon="trash" danger onClick={() => destroy(p._id, close)}>
                              Delete
                            </MenuItem>
                          </>
                        )}
                      </Dropdown>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </IndexShell>
      )}
    </div>
  );
}
