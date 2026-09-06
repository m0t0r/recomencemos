/**
 * A sheet on the ruled page: the ruling above it, a mark in the margin, and
 * whatever the caller puts in the column beside the mark.
 *
 * **It is `/my-profile`'s tier, generalised so the form can stand on it too.**
 * That page renders the three shapes of a CapabilityProfile as three sheets;
 * `/publish` and `/my-profile/edit` write the same profile one step earlier, so
 * they are drawn on the same page rather than on a second one that looks nearly
 * like it (`DESIGN.md` → Layout, and the #181 amendment to both briefs).
 *
 * **The caller supplies the element, and that is deliberate.** A tier is a
 * `<section aria-labelledby>` with an `<h2>`; a field group is a `<fieldset>`
 * with a `<legend>`, which is what makes a radio group announce its question.
 * Wrapping either in a component that picked for them would have cost one of
 * them its semantics, so this owns the grid, the ruling and the mark, and
 * nothing about what sits in the second column.
 *
 * The mark is `aria-hidden`: every sheet's heading already says in words what
 * the mark says in a glyph, and `DESIGN.md` is explicit that colour and shape
 * are never the only thing carrying a state.
 */

import { cn } from "@repo/design-system/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export interface RuledSheetProps {
  /** The mark in the margin. */
  readonly mark: LucideIcon;
  readonly children: ReactNode;
  readonly className?: string;
}

export function RuledSheet({ mark: Mark, children, className }: RuledSheetProps) {
  return (
    <div
      className={cn(
        "border-border grid grid-cols-[1.5rem_1fr] gap-x-3 border-t py-7 first:border-t-0 first:pt-0 sm:gap-x-4",
        className,
      )}
    >
      <Mark aria-hidden="true" className="text-primary mt-1 size-6" />
      {children}
    </div>
  );
}
