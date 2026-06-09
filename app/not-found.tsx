import Link from "next/link";
import { Button, EmptyState } from "@/components/ui";

/**
 * Root not-found (Stage 14) — the ultimate fallback, rendered only inside the root
 * layout (no admin/store chrome). It catches a couple of distinct cases:
 *   • the `(store)` layout calling `notFound()` for a draft/suspended store or an
 *     unknown subdomain (a suspended store going offline lands here), and
 *   • any URL that matches no route at all.
 * Kept self-contained and neutral since we don't know which app surface the visitor
 * expected.
 */
export default function NotFound() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: "var(--space-6)",
        background: "var(--bg)",
      }}
    >
      <EmptyState
        icon="store"
        title="This store isn't available"
        body="The page you're looking for doesn't exist, or this store is no longer published."
        action={
          <Link href="/">
            <Button variant="default" icon="home">
              Go home
            </Button>
          </Link>
        }
      />
    </main>
  );
}
