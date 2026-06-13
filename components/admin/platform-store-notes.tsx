"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { StoreNote } from "@/types";
import { Button, Card, Textarea, useToast } from "@/components/ui";
import {
  addStoreNoteAction,
  deleteStoreNoteAction,
} from "@/app/(admin)/platform/actions";
import { fmtDateTime } from "@/lib/format";

/**
 * Operator support-notes panel for the store-detail view (Stage 14). An internal
 * support trail pinned to one store: a small composer plus the existing notes
 * newest-first. Both mutations wrap the cross-tenant server actions (which re-assert
 * `requirePlatformAdmin` server-side) in a `useTransition` and refresh on success so
 * the server-rendered list re-derives. Note bodies are plain text — rendered via
 * default React escaping with line breaks preserved, never as raw HTML.
 */
export function PlatformStoreNotes({
  storeId,
  notes,
}: {
  storeId: string;
  notes: StoreNote[];
}) {
  const toast = useToast();
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function add() {
    const trimmed = body.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const res = await addStoreNoteAction(storeId, trimmed);
      if (res.ok) {
        setBody("");
        toast("Note added");
        router.refresh();
      } else {
        toast("Couldn't add the note", { tone: "critical" });
      }
    });
  }

  function remove(id: string) {
    setDeletingId(id);
    startTransition(async () => {
      const res = await deleteStoreNoteAction(id, storeId);
      if (res.ok) {
        toast("Note deleted");
        router.refresh();
      } else {
        toast("Couldn't delete the note", { tone: "critical" });
      }
      setDeletingId(null);
    });
  }

  return (
    <Card title="Support notes">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <Textarea
          aria-label="Add a support note"
          placeholder="Add context for the team…"
          rows={3}
          value={body}
          disabled={pending}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button
            variant="default"
            icon="plus"
            disabled={pending || !body.trim()}
            onClick={add}
          >
            Add note
          </Button>
        </div>
      </div>

      {notes.length === 0 ? (
        <div
          style={{
            marginTop: "var(--space-4)",
            padding: "var(--space-5) var(--space-4)",
            textAlign: "center",
            color: "var(--text-muted)",
            fontSize: "var(--text-sm)",
            borderTop: "var(--border-w) solid var(--border)",
          }}
        >
          No notes yet — add context for the team.
        </div>
      ) : (
        <ul style={{ listStyle: "none", margin: "var(--space-3) 0 0", padding: 0 }}>
          {notes.map((note, i) => (
            <li
              key={note._id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "var(--space-3)",
                padding: "var(--space-4) 0",
                borderTop: "var(--border-w) solid var(--border)",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: "var(--text-sm)",
                    color: "var(--text-strong)",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {note.body}
                </p>
                <div
                  style={{
                    marginTop: "var(--space-2)",
                    fontSize: "var(--text-xs)",
                    color: "var(--text-muted)",
                  }}
                >
                  <span className="mono">{note.authorEmail || "operator"}</span>
                  {" · "}
                  <time dateTime={note.createdAt}>{fmtDateTime(note.createdAt)}</time>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => remove(note._id)}
                aria-label="Delete note"
              >
                {deletingId === note._id ? "Deleting…" : "Delete"}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
