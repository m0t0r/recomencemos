/**
 * The list's Suspense fallback, and the load-bearing one on both public
 * surfaces.
 *
 * **It holds the layout, and that is the whole requirement.** The standing
 * notices sit above the list, so a fallback shorter or narrower than its content
 * moves them when the rows arrive — a layout shift the design would have had to
 * specify on purpose. It therefore mirrors the row piece for piece: the avatar,
 * the headline, the name line, the chips.
 *
 * **Mirrored rather than measured to a number.** A hard-coded height is a
 * measurement that goes stale the first time a row gains a line and nothing says
 * so. Building the fallback out of the same boxes means the height follows the
 * row's own padding and type scale.
 *
 * `aria-hidden`, because it says nothing a screen-reader user needs: the count
 * announcement is what tells them the list resolved.
 */

import { Separator } from "@repo/design-system/components/separator";
import { Skeleton } from "@repo/design-system/components/skeleton";

function RowSkeleton() {
  return (
    <div className="flex gap-4 py-5">
      {/* The avatar at `size="lg"`. */}
      <Skeleton className="size-12 shrink-0 rounded-full" />
      <div className="flex min-w-0 grow flex-col gap-2">
        <div className="flex flex-col gap-1.5">
          {/* One line of headline at the row's 28 px leading, then the name line. */}
          <Skeleton className="h-6 w-full max-w-lg" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Skeleton className="h-6 w-44 rounded-4xl" />
          <Skeleton className="h-6 w-32 rounded-4xl" />
        </div>
      </div>
    </div>
  );
}

/**
 * @param count how many placeholder rows to draw. Six is past the fold on a
 * phone, which is as far as a fallback can usefully hold: rows below it move
 * nothing above them when the real ones arrive.
 */
export function ProfileListSkeleton({ count = 6 }: { readonly count?: number }) {
  return (
    <div className="ruled-page" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div key={index}>
          {index > 0 ? <Separator /> : null}
          <RowSkeleton />
        </div>
      ))}
    </div>
  );
}
