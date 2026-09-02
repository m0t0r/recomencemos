/**
 * The grid's Suspense fallback, and the load-bearing one on both public lists.
 *
 * **It holds the layout, and that is the whole requirement.** The standing
 * notices sit above the grid, so a fallback shorter or narrower than its content
 * moves them when the cards arrive — a layout shift the design would have had to
 * specify on purpose. It therefore renders in the grid's own columns and mirrors
 * the card's structure piece for piece: the avatar, the two header lines, the
 * headline, the Skill row.
 *
 * **Mirrored rather than measured to a number.** A hard-coded height is a
 * measurement that goes stale the first time the card gains a line and nothing
 * says so. Building the fallback out of the same boxes means the height follows
 * the card's own padding and type scale.
 *
 * `aria-hidden`, because it says nothing a screen-reader user needs: the count
 * announcement is what tells them the grid resolved.
 */

import { Card, CardContent, CardHeader } from "@repo/design-system/components/card";
import { Skeleton } from "@repo/design-system/components/skeleton";
import { GRID_COLUMNS } from "./profile-grid";

function CardSkeleton() {
  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-start gap-4">
        {/* The avatar at `size="lg"`. */}
        <Skeleton className="size-12 shrink-0 rounded-full" />
        <div className="flex min-w-0 flex-col gap-2 pt-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3.5 w-20" />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {/* Two lines of headline, at the body line height. */}
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-4/5" />
        </div>
        {/*
          Three Skill badges, each on its own row — which is how they actually
          wrap at a column's width, since a label is a verb phrase rather than a
          word. Laying them out side by side made the fallback about a hundred
          pixels shorter than the card, measured against a screenshot of both.
        */}
        <div className="flex flex-col items-start gap-1.5">
          <Skeleton className="h-6 w-44 rounded-md" />
          <Skeleton className="h-6 w-52 rounded-md" />
          <Skeleton className="h-6 w-36 rounded-md" />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * @param count how many placeholder cards to draw. A page's worth on a first
 * load; the caller passes fewer where it knows the list is shorter.
 */
export function ProfileGridSkeleton({ count = 6 }: { readonly count?: number }) {
  return (
    <div className={GRID_COLUMNS} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <CardSkeleton key={index} />
      ))}
    </div>
  );
}
