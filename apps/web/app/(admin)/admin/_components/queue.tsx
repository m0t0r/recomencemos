import { Alert, AlertDescription } from "@repo/design-system/components/alert";
import { Card } from "@repo/design-system/components/card";
import { Skeleton } from "@repo/design-system/components/skeleton";
import type { ComponentType } from "react";
import {
  OLDEST_ITEM_LABEL,
  oldestItemHours,
  QUEUE_EMPTY_BODY,
  QUEUE_EMPTY_TITLE,
  sourceFailed,
} from "../_lib/messages";
import type { QueueBranch, QueueItem, QueueSource } from "../_lib/queue-sources";

/**
 * The queue's four states, as four components — the spec's Admin-queue row made
 * renderable before there is anything to render.
 *
 * **They are built and tested now, with an empty source registry, and that is the
 * ticket rather than a stub.** #17 is _"the queue shell every later moderation
 * source plugs into"_: story 7 adds a row to `QUEUE_SOURCES` and inherits the
 * empty state, the per-source skeleton, the named failure and the oldest-item
 * figure without deciding any of them again. Deferring these until there was data
 * would mean deciding them under time pressure, five times, one per source.
 */

/**
 * NFR7's number, and story 7's requirement that **the age of the oldest item
 * renders first**.
 *
 * It is first because it is the one figure that says whether today is an ordinary
 * day: the requirement is ≤ 24 h, and an Admin who reads this before the list
 * knows how to spend the next hour. Everything below it is detail.
 */
export function OldestItem({ hours }: { hours: number }) {
  return (
    <div className="flex flex-col items-end gap-1">
      <p className="text-muted-foreground text-sm leading-5">{OLDEST_ITEM_LABEL}</p>
      {/*
        **A number, including when it is zero** — the acceptance criterion in as
        many words. `tabular-nums` so the figure does not jitter as it changes
        width, on a screen somebody reloads all day.
      */}
      <p className="text-foreground text-2xl leading-8 font-semibold tabular-nums">
        {oldestItemHours(hours)}
      </p>
    </div>
  );
}

/**
 * The oldest-item figure's fallback, at the figure's exact height so the heading
 * beside it does not move when the number lands.
 */
export function OldestItemSkeleton() {
  return (
    <div className="flex flex-col items-end gap-1" aria-hidden="true">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-8 w-16" />
    </div>
  );
}

/**
 * The empty queue — **a real and good state**, which is the acceptance criterion's
 * own wording and the reason this is not the generic "nothing here" card.
 *
 * A queue at zero means every Offer has been read and nobody is waiting behind
 * NFR7's band. Rendered as an absence it would be indistinguishable from a screen
 * that failed to load its sources, which on a moderation queue is the one
 * ambiguity that costs someone a delivered Offer.
 */
export function QueueEmpty() {
  return (
    <Card className="flex flex-col gap-2 p-6">
      <p className="text-foreground text-base leading-6 font-medium">{QUEUE_EMPTY_TITLE}</p>
      <p className="text-muted-foreground text-sm leading-5">{QUEUE_EMPTY_BODY}</p>
    </Card>
  );
}

/**
 * A source that failed, **named**.
 *
 * _"A source failed: say which, because a silently missing source is an unreviewed
 * Offer."_ The name is the requirement.
 *
 * **`Alert` from the registry**, which is also where its `role="alert"` comes
 * from — and here that role is kept rather than overridden, unlike every other
 * announcement in this app. The others report what the Admin just did and are
 * announced politely; this one reports that the screen is understating how much
 * work is left, which is the case `alert` exists for.
 */
export function SourceFailed({ label }: { label: string }) {
  return (
    <Alert variant="destructive">
      <AlertDescription>{sourceFailed(label)}</AlertDescription>
    </Alert>
  );
}

/**
 * The per-source loading state.
 *
 * **Labelled with its source**, which the Suspense-boundary table asks for in as
 * many words — an unlabelled skeleton says "something is coming" where the Admin
 * needs to know *which* branch has not arrived, so that a source still spinning
 * cannot be read as a source with nothing in it.
 *
 * Rows at the item's height, so nothing moves when the real ones land.
 */
export function SourceSkeleton({ label }: { label: string }) {
  return (
    <Card className="flex flex-col gap-3 p-4" aria-busy="true" aria-label={label}>
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
    </Card>
  );
}

/**
 * One source's items, once they have arrived.
 *
 * **`Item` is how a source that has something to be done to it renders its own
 * row**, and its absence is the shell's default: the summary, and nothing to
 * press. It is a prop rather than a field on `QueueSource` so that this module
 * and the registry beside it stay importable from a test — a row component
 * reaches a Server Action, which reaches the domain, and a registry that carried
 * one could not be read by the pure suite that checks the oldest-item arithmetic.
 *
 * It is also transitional. Each source gets its own route behind the sidebar
 * shell, where the row shape, its affordances and its focus behaviour are that
 * ticket's work; this is what keeps a resolver usable on the screen that exists
 * in the meantime.
 */
export function SourceBranch({
  source,
  branch,
  Item,
}: {
  source: QueueSource;
  branch: QueueBranch;
  Item?: ComponentType<{ readonly item: QueueItem }>;
}) {
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-foreground text-base font-semibold">{source.label}</h2>
        {/*
          The **branch's** total, not `items.length` — C55: each branch is
          `LIMIT`-capped for display while its count is computed over the whole
          branch. Showing the capped length here would report a depth of 20 when
          400 Offers are waiting, which is NFR7's detector quietly disabled.
        */}
        <p className="text-muted-foreground text-sm tabular-nums">{branch.total}</p>
      </div>

      <ul className="flex flex-col gap-2">
        {branch.items.map((item) => (
          <li key={item.id} className="border-border rounded-md border p-3">
            {Item ? (
              <Item item={item} />
            ) : (
              <p className="text-foreground text-sm leading-5">{item.summary}</p>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
