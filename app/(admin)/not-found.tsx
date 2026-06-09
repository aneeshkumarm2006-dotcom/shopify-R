import Link from "next/link";
import { Button, EmptyState } from "@/components/ui";

/**
 * Admin not-found (Stage 14). Hit when a page calls `notFound()` — a missing product/
 * order/customer, or a route an operator isn't entitled to (platform role gate). Plain
 * affordance back to the dashboard rather than the bare framework 404.
 */
export default function AdminNotFound() {
  return (
    <EmptyState
      icon="search"
      title="Not found"
      body="We couldn't find that page. It may have been deleted, or you don't have access to it."
      action={
        <Link href="/dashboard">
          <Button variant="default" icon="home">
            Back to dashboard
          </Button>
        </Link>
      }
    />
  );
}
