import { Alert, AlertDescription } from "@repo/design-system/components/alert";
import { Card } from "@repo/design-system/components/card";
import { cn } from "@repo/design-system/lib/utils";
import { Skeleton } from "@repo/design-system/components/skeleton";
import { TriangleAlertIcon } from "lucide-react";
import type { ComponentType } from "react";
import {
  OLDEST_ITEM_LABEL,
  oldestItemHours,
  PAST_BAND_MARKER,
  QUEUE_EMPTY_BODY,
  QUEUE_EMPTY_TITLE,
  SECTION_NOT_LIVE_ANNOUNCEMENT,
  SECTION_NOT_LIVE_BODY,
  SECTION_NOT_LIVE_SHORT,
  SECTION_NOT_LIVE_TITLE,
  sectionWaiting,
  sourceFailed,
} from "../_lib/messages";
import type { QueueBranch, QueueItem } from "../_lib/queue-sources";

/**
 * The states a section can be in, as components — the spec's Admin-queue row
 * made renderable, and the reason a section ticket has none of this to decide.
 *
 * **They are tested against fixtures rather than against a running server**,
 * which is what `web:test` is for: a skeleton without its source name and a
 * failure without its `alert` role are both invisible to a CSS selector and both
 * are the finding.
 */

/**
 * NFR7's number, and story 7's requirement that **the age of the oldest item
 * renders first**.
 *
 * It is first because it is the one figure that says whether today is an ordinary
 * day: the requirement is ≤ 24 h, and an Admin who reads this before the list
 * knows how to spend the next hour. Everything below it is detail.
 *
 * **It lives in the shell rather than in the sidebar**, which is the half of the
 * criterion that is easy to lose: the nav collapses on a narrow viewport and this
 * figure may not go with it.
 */
export function OldestItem({ hours }: { hours: number }) {
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
    </div>
  );
}

/**
 * The oldest-item figure's fallback, at the figure's exact height so the heading
 * beside it does not move when the number lands.
 */
export function OldestItemSkeleton() {
  return (
    <div className="flex flex-col items-end gap-0.5" aria-hidden="true">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-8 w-16" />
    </div>
  );
}

/**
 * A section with nothing waiting — **a real and good state**, which is the
 * acceptance criterion's own wording and the reason this is not the generic
 * "nothing here" card.
 *
 * Zero means everything in this section has been read and nobody is waiting
 * behind its band. Rendered as an absence it would be indistinguishable from a
 * screen that failed to load its source, which on a moderation queue is the one
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
 * A section whose story has not landed.
 *
 * **Deliberately not {@link QueueEmpty}, and the distinction is the whole point.**
 * Empty means everything was read; this means nothing was ever asked. A section
 * that reported zero here would tell an Admin the branch is clear while it is not
 * being counted at all — the unreviewed Offer this surface exists to prevent,
 * produced by the surface itself.
 */
export function SectionNotLive() {
  return (
    <Card className="flex flex-col gap-2 p-6">
      <p className="text-foreground text-base leading-6 font-medium">{SECTION_NOT_LIVE_TITLE}</p>
      <p className="text-muted-foreground text-sm leading-5">{SECTION_NOT_LIVE_BODY}</p>
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
 * One section's items, once they have arrived.
 *
 * **`Item` is how a section that has something to be done to it renders its own
 * row**, and its absence is the shell's default: the summary, and nothing to
 * press. It is a prop rather than a field on the registry so that the registry
 * stays importable from a pure test — a row component reaches a Server Action,
 * which reaches the domain.
 *
 * The heading and the count sit above this in the section page, because the page
 * has one section and the count belongs beside the name of the thing it counts.
 */
export function SourceBranch({
  branch,
  Item,
}: {
  branch: QueueBranch;
  Item?: ComponentType<{ readonly item: QueueItem }>;
}) {
  return (
    <ul className="flex flex-col gap-3">
      {branch.items.map((item) => (
        <li key={item.id} className="border-border bg-card rounded-lg border p-4">
          {Item ? (
            <Item item={item} />
          ) : (
            <p className="text-foreground text-sm leading-5">{item.summary}</p>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * A section whose oldest item has passed its band.
 *
 * **The word is the marker; the icon and the colour are the redundant halves.**
 * The acceptance criterion asks for a text equivalent in as many words, and WCAG
 * 2.2 AA 1.4.1 asks for it again — so a reader who cannot see the red, or the
 * triangle, still reads _fuera de plazo_.
 *
 * **One component for both places it appears** — the nav item and the section's
 * own page. The two were written separately and had already drifted a size apart,
 * which is the shape of a marker that eventually drifts a *word* apart.
 */
export function PastBandMarker({ className }: { className?: string }) {
  return (
    <span className={cn("text-destructive flex items-center gap-1 font-medium", className)}>
      <TriangleAlertIcon aria-hidden="true" className="size-[1.1em]" />
      {PAST_BAND_MARKER}
    </span>
  );
}

/**
 * What a nav item says about its section: how much is waiting, and whether the
 * oldest thing in it has passed the band.
 *
 * **The figure is `aria-hidden` and paired with a phrase**, because "Propuestas,
 * 12" read aloud is a list position as easily as a backlog. One fact rendered
 * twice rather than two facts that can drift.
 *
 * It renders **inside** the nav link rather than in the registry's badge slot,
 * which is positioned outside the button: a count that is not part of the link's
 * accessible name is a count a screen-reader user has to go looking for.
 */
export function SectionBadge({ total, late }: { total: number; late: boolean }) {
  return (
    <span className="ml-auto flex shrink-0 items-center gap-1.5 text-xs">
      {late ? <PastBandMarker /> : null}
      <span aria-hidden="true" className="tabular-nums">
        {total}
      </span>
      <span className="sr-only">{sectionWaiting(total)}</span>
    </span>
  );
}

/**
 * A nav item for a section with no resolver.
 *
 * **A dash, and never a zero.** The dash is the honest rendering of a branch
 * nobody counted, and the announcement says which of the two it is — a screen
 * reader given "—" alone hears punctuation or nothing.
 */
export function SectionBadgeAbsent() {
  return (
    <span className="text-muted-foreground ml-auto flex shrink-0 items-center gap-1.5 text-xs">
      <span aria-hidden="true">{SECTION_NOT_LIVE_SHORT}</span>
      <span className="sr-only">{SECTION_NOT_LIVE_ANNOUNCEMENT}</span>
    </span>
  );
}

/** The nav item's figure before its branch has answered. */
export function SectionBadgeSkeleton() {
  return <Skeleton aria-hidden="true" className="ml-auto h-3.5 w-6 shrink-0" />;
}
