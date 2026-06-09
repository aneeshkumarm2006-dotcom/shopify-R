import type { Metadata } from "next";
import Link from "next/link";
import { Card, EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Analytics" };

/**
 * Analytics (DESIGN §4.1 nav). The MVP keeps reporting minimal (PRD §6.9) — the
 * headline numbers live on the dashboard, so this is a deliberate signpost rather
 * than a second reporting surface. Deeper analytics are out of scope for now.
 */
export default function AnalyticsPage() {
  return (
    <div>
      <PageHeader title="Analytics" />
      <Card>
        <EmptyState
          icon="analytics"
          title="Deeper analytics coming later"
          body="The MVP keeps reporting minimal. Your headline numbers — sales, orders, customers, low stock — live on the dashboard."
          action={
            <Link href="/dashboard" className="btn btn-md btn-default">
              Back to Home
            </Link>
          }
        />
      </Card>
    </div>
  );
}
