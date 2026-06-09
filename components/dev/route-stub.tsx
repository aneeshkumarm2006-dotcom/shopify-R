import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/icon";

/**
 * Placeholder for routes whose real screens are built in a later stage. Stage 0
 * only establishes the folder/route map; each stub names the stage that fills it.
 * These are dev scaffolding and get replaced (not extended) by the owning stage.
 */
export function RouteStub({
  title,
  stage,
  icon = "layout",
  children,
}: {
  title: string;
  stage: string;
  icon?: IconName;
  children?: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-[720px] flex-col items-start justify-center gap-4 px-6 py-16">
      <span className="inline-flex items-center gap-2 rounded-pill border border-border bg-surface-subtle px-3 py-1 text-xs text-text-muted">
        <Icon name={icon} size={14} />
        {stage}
      </span>
      <h1 className="font-display text-3xl text-text-strong">{title}</h1>
      <p className="text-base text-text-muted">
        Route scaffolded in Stage 0. The real screen lands in {stage}.
      </p>
      {children}
      <Link
        href="/_kitchen-sink"
        className="mt-2 inline-flex items-center gap-1 text-sm text-text underline-offset-4 hover:underline"
      >
        View the Stage 0 foundation check <Icon name="arrowRight" size={14} />
      </Link>
    </main>
  );
}
