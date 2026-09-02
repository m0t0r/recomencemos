/**
 * The panel a public list shows when it has no cards — **never a blank region**,
 * which is the one thing the spec says about this state on both surfaces.
 *
 * Shared because the two lists reach it for three different reasons and show it
 * the same way: nothing published at all, and — on `/profiles` — nothing in the
 * part of the list the reader is standing in. What differs is the sentence and
 * where the way out goes, so those are the props and nothing else is.
 *
 * It is not a landmark. A `section` with no accessible name is ordinary content,
 * which is what this is: the heading is what a screen-reader user navigates to.
 */

import { buttonVariants } from "@repo/design-system/components/button";
import Link from "next/link";

export function ListEmptyState({
  title,
  body,
  actionHref,
  actionLabel,
  actionVariant = "default",
}: {
  readonly title: string;
  readonly body: string;
  readonly actionHref: string;
  readonly actionLabel: string;
  readonly actionVariant?: "default" | "outline";
}) {
  return (
    <section className="border-border bg-muted/40 flex flex-col items-start gap-4 rounded-lg border p-6">
      <h2 className="text-foreground text-xl font-semibold tracking-tight">{title}</h2>
      <p className="text-muted-foreground max-w-prose text-pretty">{body}</p>
      <Link href={actionHref} className={buttonVariants({ variant: actionVariant })}>
        {actionLabel}
      </Link>
    </section>
  );
}
