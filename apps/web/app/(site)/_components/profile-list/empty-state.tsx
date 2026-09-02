/**
 * The panel a public list shows when it has no cards — **never a blank region**,
 * which is the one thing the spec says about this state on both surfaces.
 *
 * Shared because the two lists reach it for three different reasons and show it
 * the same way: nothing published at all, and — on `/profiles` — nothing in the
 * part of the list the reader is standing in. What differs is the sentence and
 * where the way out goes, so those are the props and nothing else is.
 *
 * **Built on the registry's `empty`, not hand-rolled.** The container, the
 * header, the description and the content slot are the registry's.
 *
 * **The title is an `h2` rather than `EmptyTitle`, and that is the one
 * departure.** `EmptyTitle` renders a `div`, so it reaches the accessibility
 * tree as text — and this panel is frequently the *only* content on the page,
 * which would leave a screen-reader user with a `main` holding no heading below
 * the page's own. It carries the same classes the registry gives that slot, so
 * nothing about it looks different.
 */

import { buttonVariants } from "@repo/design-system/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
} from "@repo/design-system/components/empty";
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
    <Empty className="border">
      <EmptyHeader>
        <h2 className="font-heading text-lg font-medium tracking-tight">{title}</h2>
        <EmptyDescription>{body}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Link href={actionHref} className={buttonVariants({ variant: actionVariant })}>
          {actionLabel}
        </Link>
      </EmptyContent>
    </Empty>
  );
}
