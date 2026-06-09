"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Collection } from "@/types";
import {
  Button,
  Dropdown,
  EmptyState,
  IconButton,
  MenuItem,
  MenuSeparator,
  NoResultsState,
  PageHeader,
  useToast,
} from "@/components/ui";
import { IndexShell } from "@/components/admin/index-shell";
import { removeCollection } from "@/app/(admin)/collections/actions";

/**
 * Collections index (Stage 9, PRD §5.5) — the §3.4 index table listing manual
 * product groupings with title · handle · product count, plus a per-row menu
 * (edit / delete). Row → collection editor. Reached from the Products area, so it
 * doesn't add a primary nav item (keeps the 8-item sidebar intact).
 */
export function CollectionsIndex({ collections }: { collections: Collection[] }) {
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return collections;
    return collections.filter(
      (c) => c.title.toLowerCase().includes(q) || c.handle.toLowerCase().includes(q),
    );
  }, [collections, query]);

  function destroy(id: string, close: () => void) {
    startTransition(async () => {
      await removeCollection(id);
      close();
      toast("Collection deleted");
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
            onClick={() => router.push("/products")}
          >
            Products
          </button>
        }
        title="Collections"
        actions={
          <Button
            variant="primary"
            icon="plus"
            onClick={() => router.push("/collections/new")}
          >
            Add collection
          </Button>
        }
      />

      {collections.length === 0 ? (
        <EmptyState
          icon="layers"
          title="No collections yet"
          body="Group products into collections to feature them on your storefront."
          action={
            <Button
              variant="primary"
              icon="plus"
              onClick={() => router.push("/collections/new")}
            >
              Add collection
            </Button>
          }
        />
      ) : (
        <IndexShell
          tabsLabel="Collections"
          tabs={[{ value: "All", label: "All", count: collections.length }]}
          active="All"
          onTabChange={() => {}}
          query={query}
          onQueryChange={setQuery}
          searchPlaceholder="Search collections"
          showSort={false}
        >
          {rows.length === 0 ? (
            <NoResultsState onClear={() => setQuery("")} />
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Collection</th>
                  <th scope="col">Handle</th>
                  <th scope="col" className="col-right">
                    Products
                  </th>
                  <th scope="col" style={{ width: 44 }} aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr
                    key={c._id}
                    className="is-clickable"
                    onClick={() => router.push(`/collections/edit/${c._id}`)}
                  >
                    <td>
                      <span style={{ fontWeight: 500, color: "var(--text-strong)" }}>
                        {c.title}
                      </span>
                    </td>
                    <td>
                      <span className="mono" style={{ color: "var(--text-muted)" }}>
                        {c.handle}
                      </span>
                    </td>
                    <td className="col-right num">
                      <span style={{ color: "var(--text)" }}>{c.productIds.length}</span>
                    </td>
                    <td className="col-check" onClick={(e) => e.stopPropagation()}>
                      <Dropdown
                        trigger={
                          <IconButton
                            name="dots"
                            size={28}
                            aria-label={`Actions for ${c.title}`}
                          />
                        }
                      >
                        {(close) => (
                          <>
                            <MenuItem
                              icon="eye"
                              onClick={() => {
                                router.push(`/collections/edit/${c._id}`);
                                close();
                              }}
                            >
                              Edit
                            </MenuItem>
                            <MenuSeparator />
                            <MenuItem
                              icon="trash"
                              danger
                              onClick={() => destroy(c._id, close)}
                            >
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
