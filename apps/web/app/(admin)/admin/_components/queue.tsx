import { Alert, AlertDescription } from "@repo/design-system/components/alert";
import { Card } from "@repo/design-system/components/card";
import { cn } from "@repo/design-system/lib/utils";
import { Skeleton } from "@repo/design-system/components/skeleton";
import { TriangleAlertIcon } from "lucide-react";
import {
  OLDEST_ITEM_LABEL,
  oldestItemHours,
  PAST_BAND_MARKER,
  QUEUE_EMPTY_BODY,
  QUEUE_EMPTY_TITLE,
  sourceFailed,
  waitingInQueue,
} from "../_lib/messages";

/**
 * The states the queue can be in, as components — the spec's Admin-queue row
 * made renderable.
 *
 * **They are tested against fixtures rather than against a running server**,
 * which is what `web:test` is for: a skeleton without its name and a failure
 * without its `alert` role are both invisible to a CSS selector and both are the
 * finding.
 */

/**
 * NFR7's number and the count beside it, which **render first** (story 7).
 *
 * The age is first because it is the one figure that says whether today is an
 * ordinary day: the requirement is ≤ 24 h, and an Admin who reads this before
 * the list knows how to spend the next hour. The count says how much is behind
 * it, **over every whole branch** (C55) — so it can say 400 while the list shows
 * twenty, which is the point of saying it.
 */
export function QueueHeadline({ hours, waiting }: { hours: number; waiting: number }) {
  return (
    <div className="flex flex-col items-end gap-0.5">
      <p className="text-muted-foreground text-xs leading-4">{OLDEST_ITEM_LABEL}</p>
      {/*
        **A number, including when it is zero** — the acceptance criterion in as
        many words. `tabular-nums` so the figure does not jitter as it changes
        width, on a screen somebody reloads all day.
      */}
      <p className="text-foreground text-2xl leading-8 font-semibold tabular-nums">
        {oldestItemHours(hours)}
      </p>
      <p className="text-muted-foreground text-xs leading-4 tabular-nums">
        {waitingInQueue(waiting)}
      </p>
    </div>
  );
}

/**
 * The headline's fallback, at the headline's exact height so the heading beside
 * it does not move when the number lands.
 */
export function QueueHeadlineSkeleton() {
  return (
    <div className="flex flex-col items-end gap-0.5" aria-hidden="true">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-4 w-20" />
    </div>
  );
}

/**
 * The queue with nothing waiting — **a real and good state**, which is the
 * acceptance criterion's own wording and the reason this is not the generic
 * "nothing here" card.
 *
 * Zero means everything has been read and nobody is waiting behind the band.
 * Rendered as an absence it would be indistinguishable from a screen that failed
 * to load its sources, which on a moderation queue is the one ambiguity that
 * costs someone a delivered Offer.
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
 * Offer."_ The name is the requirement: in one list the rows that did arrive
 * fill the screen, and nothing else says a branch is missing from among them.
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
 * The list's loading state.
 *
 * **Labelled**, which the Suspense-boundary table asks for in as many words — an
 * unlabelled skeleton says "something is coming" where the Admin needs to know it
 * is the queue that has not arrived, so that a list still loading cannot be read
 * as a list with nothing in it.
 *
 * Rows at the table row's height, so nothing moves when the real ones land.
 */
export function QueueSkeleton({ label }: { label: string }) {
  return (
    <Card className="flex flex-col gap-3 p-4" aria-busy="true" aria-label={label}>
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-5 w-2/3" />
    </Card>
  );
}

/**
 * A row whose item has passed its source's band.
 *
 * **The word is the marker; the icon and the colour are the redundant halves.**
 * The acceptance criterion asks for a text equivalent in as many words, and WCAG
 * 2.2 AA 1.4.1 asks for it again — so a reader who cannot see the red, or the
 * triangle, still reads _fuera de plazo_.
 */
export function PastBandMarker({ className }: { className?: string }) {
  return (
    <span className={cn("text-destructive flex items-center gap-1 font-medium", className)}>
      <TriangleAlertIcon aria-hidden="true" className="size-[1.1em]" />
      {PAST_BAND_MARKER}
    </span>
  );
}
