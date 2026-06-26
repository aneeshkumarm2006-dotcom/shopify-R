"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { GiftCard } from "@/types";
import {
  Button,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Pill,
  useToast,
} from "@/components/ui";
import { money, fmtDate } from "@/lib/format";
import { issueGiftCard, toggleGiftCardStatus } from "@/app/(admin)/gift-cards/actions";

/**
 * Gift-cards admin (Phase 4) — issue store-credit cards and enable/disable them. The
 * code is generated server-side; balance draws down at checkout. Disabling a card
 * blocks further redemption without erasing its history.
 */
export function GiftCardsAdmin({ cards, currency }: { cards: GiftCard[]; currency: string }) {
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();
  const [issuing, setIssuing] = useState(false);

  function toggle(card: GiftCard) {
    const next = card.status === "active" ? "disabled" : "active";
    startTransition(async () => {
      await toggleGiftCardStatus(card._id, next);
      toast(next === "active" ? "Gift card enabled" : "Gift card disabled");
      router.refresh();
    });
  }

  function statusPill(card: GiftCard) {
    if (card.status === "disabled") return <Pill tone="muted">Disabled</Pill>;
    if (card.balance <= 0) return <Pill tone="muted">Empty</Pill>;
    return <Pill tone="success">Active</Pill>;
  }

  return (
    <div>
      <PageHeader
        title="Gift Cards"
        actions={
          <Button variant="primary" icon="plus" onClick={() => setIssuing(true)}>
            Issue gift card
          </Button>
        }
      />

      {issuing && (
        <IssueModal
          onClose={() => setIssuing(false)}
          onIssued={(code) => {
            toast(`Issued ${code}`);
            setIssuing(false);
            router.refresh();
          }}
        />
      )}

      {cards.length === 0 ? (
        <EmptyState
          icon="sparkle"
          title="No gift cards yet"
          body="Issue store credit your customers can redeem at checkout."
          action={
            <Button variant="primary" icon="plus" onClick={() => setIssuing(true)}>
              Issue gift card
            </Button>
          }
        />
      ) : (
        <table className="tbl">
          <thead>
            <tr>
              <th scope="col">Code</th>
              <th scope="col">Status</th>
              <th scope="col" className="col-right">Balance</th>
              <th scope="col" className="col-right">Issued</th>
              <th scope="col">Note</th>
              <th scope="col" style={{ width: 110 }} aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {cards.map((c) => (
              <tr key={c._id}>
                <td className="mono" style={{ fontWeight: 500, color: "var(--text-strong)" }}>{c.code}</td>
                <td>{statusPill(c)}</td>
                <td className="col-right num">
                  <span style={{ color: "var(--text-strong)" }}>{money(c.balance, currency)}</span>
                  {c.balance !== c.initialBalance && (
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                      {" "}/ {money(c.initialBalance, currency)}
                    </span>
                  )}
                </td>
                <td className="col-right num" style={{ color: "var(--text-muted)" }}>{fmtDate(c.createdAt)}</td>
                <td style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>{c.note || "—"}</td>
                <td className="col-right">
                  <Button size="sm" variant="default" onClick={() => toggle(c)}>
                    {c.status === "active" ? "Disable" : "Enable"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function IssueModal({
  onClose,
  onIssued,
}: {
  onClose: () => void;
  onIssued: (code: string) => void;
}) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [code, setCode] = useState("");

  function submit() {
    startTransition(async () => {
      const res = await issueGiftCard({
        amount: Number(amount),
        note,
        ...(code.trim() ? { code: code.trim() } : {}),
      });
      if (!res.ok || !res.code) {
        toast(res.error ?? "Couldn't issue the gift card", { tone: "critical" });
        return;
      }
      onIssued(res.code);
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Issue gift card"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={pending}>
            Issue
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <Field label="Amount">
          <Input mono value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="50.00" autoFocus />
        </Field>
        <Field label="Code" help="Leave blank to generate one automatically">
          <Input mono value={code} onChange={(e) => setCode(e.target.value)} placeholder="GIFT-XXXX-XXXX-XXXX" />
        </Field>
        <Field label="Note" help="Optional — who/why it was issued">
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
