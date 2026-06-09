import Link from "next/link";
import { Button, EmptyState } from "@/components/ui";

/**
 * Storefront not-found (Stage 14) — a product/collection/page handle that doesn't
 * exist. On-brand, with a way back to the store home rather than the bare 404.
 */
export default function StoreNotFound() {
  return (
    <div className="store-container" style={{ paddingTop: "var(--space-16)", paddingBottom: "var(--space-16)" }}>
      <EmptyState
        icon="search"
        title="We couldn't find that"
        body="The page or product you're looking for may have moved or sold out."
        action={
          <Link href="/">
            <Button variant="default" icon="home">
              Back to store
            </Button>
          </Link>
        }
      />
    </div>
  );
}
