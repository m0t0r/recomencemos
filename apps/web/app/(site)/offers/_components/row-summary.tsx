"use client";

/**
 * A ledger row's `<summary>`, which takes focus when the row arrives open from a
 * link.
 *
 * **Focus on mount, not `autoFocus`**, for the reason `ArrivalStatus` gives:
 * `autoFocus` on server-rendered markup is not honoured once the segment streams
 * in after the shell. Focusing it is also what scrolls a deep-linked row into
 * view — the email's `/offers/<id>` may name an Offer several rows down.
 *
 * **A client component around the summary rather than beside it**, because a
 * `<summary>` must be the first child of its `<details>`: a sibling that went
 * looking for it would be reaching through the DOM for a node React already
 * holds. Its children stay Server Components and ship as markup.
 *
 * **The browser's own marker is removed in both engines' spellings** —
 * `list-none` for the `::marker`, and the `-webkit-details-marker` rule for
 * Safari's — and the row draws its own chevron in its place, placed where the
 * grid puts it. The standing notices measured that a summary with no visible
 * affordance reads as static text.
 */

import { type ReactNode, useEffect, useRef } from "react";

export function RowSummary({
  focusOnMount,
  children,
}: {
  readonly focusOnMount: boolean;
  readonly children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (focusOnMount) ref.current?.focus();
  }, [focusOnMount]);

  return (
    <summary
      ref={ref}
      className="focus-visible:ring-ring grid cursor-pointer list-none [&::-webkit-details-marker]:hidden grid-cols-[1fr_auto] items-start gap-x-3 gap-y-1 rounded-sm py-5 focus-visible:ring-2 focus-visible:outline-none"
    >
      {children}
    </summary>
  );
}
