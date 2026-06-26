"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Location } from "@/types";
import { Button, Card, Input, PageHeader, Pill, useToast } from "@/components/ui";
import {
  createLocationAction,
  renameLocationAction,
  setDefaultLocationAction,
  deleteLocationAction,
} from "@/app/(admin)/locations/actions";

/**
 * Locations admin (Phase 6). Add/rename/delete locations and pick the default. Stock is
 * allocated per location from the Inventory screen; the sellable total is the sum.
 */
export function LocationsAdmin({ locations }: { locations: Location[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");

  function add() {
    if (!name.trim()) return;
    startTransition(async () => {
      const res = await createLocationAction(name.trim());
      if (!res.ok) {
        toast(res.error ?? "Couldn't add the location", { tone: "critical" });
        return;
      }
      setName("");
      toast("Location added");
      router.refresh();
    });
  }
  function makeDefault(id: string) {
    startTransition(async () => {
      await setDefaultLocationAction(id);
      toast("Default location updated");
      router.refresh();
    });
  }
  function rename(id: string, current: string) {
    const next = window.prompt("Rename location", current)?.trim();
    if (!next || next === current) return;
    startTransition(async () => {
      await renameLocationAction(id, next);
      router.refresh();
    });
  }
  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteLocationAction(id);
      if (!res.ok) toast(res.error ?? "Couldn't delete", { tone: "critical" });
      else {
        toast("Location deleted");
        router.refresh();
      }
    });
  }

  return (
    <div>
      <PageHeader title="Locations" />

      <Card title="Add a location" style={{ marginBottom: "var(--space-5)" }}>
        <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Warehouse B"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add();
                }
              }}
            />
          </div>
          <Button variant="primary" onClick={add} loading={pending} disabled={!name.trim()}>
            Add location
          </Button>
        </div>
      </Card>

      <Card title="Locations" pad={false}>
        <table className="tbl">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Default</th>
              <th scope="col" style={{ width: 240 }} aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {locations.map((l) => (
              <tr key={l._id}>
                <td style={{ fontWeight: 500, color: "var(--text-strong)" }}>{l.name}</td>
                <td>{l.isDefault ? <Pill tone="info">Default</Pill> : <span style={{ color: "var(--text-muted)" }}>—</span>}</td>
                <td className="col-right">
                  <div style={{ display: "inline-flex", gap: 6 }}>
                    {!l.isDefault && (
                      <Button size="sm" variant="default" onClick={() => makeDefault(l._id)} disabled={pending}>
                        Make default
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => rename(l._id, l.name)} disabled={pending}>
                      Rename
                    </Button>
                    {!l.isDefault && (
                      <Button size="sm" variant="ghost" icon="trash" aria-label="Delete" onClick={() => remove(l._id)} disabled={pending} />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
