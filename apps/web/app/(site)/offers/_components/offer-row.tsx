/**
 * One row of the list: a link to its Offer, saying who it is with, how long ago,
 * what the work is, where it stands and what it pays.
 *
 * **Direction is the first word** — _De Carlos Restrepo_, _Para Ana María R._ —
 * because a person reading word by word must know which way an Offer went before
 * anything else, and an arrow or a colour would say it to fewer people (WCAG
 * 1.4.1).
 *
 * **The registry's `Item`, rendered as the link.** Base UI's `render` prop makes
 * the row itself the `<a>`, so the whole row is the tap target and no wrapper
 * stands between them. The row is the Offer's heading, an `h3` under the list's
 * `h2`, so a screen-reader user listing headings finds one per Offer.
 *
 * **Its accessible name is short on purpose.** The work is an excerpt cut on a
 * word, not the whole description, so reading the list link by link is a list of
 * Offers rather than of paragraphs. **The pay is never cut**: it wraps, because
 * it is the one line she compares rows by.
 *
 * A Server Component. Nothing here is interactive but the link.
 */

import {
  Item,
  ItemContent,
  ItemDescription,
  ItemHeader,
  ItemTitle,
} from "@repo/design-system/components/item";
import Link from "next/link";
import type { Entry } from "../_lib/mailbox-view";
import { CONTACT_INSIDE, excerpt, fromLine, sentAgo } from "../_lib/messages";
import { offerRecipient } from "../_lib/sent-messages";
import { EntryStateBadge } from "./entry-state-badge";

/** Who the Offer is with, direction first, in words. */
function counterpartLine(entry: Entry): string {
  return entry.direction === "received"
    ? fromLine(entry.offer.hirerName)
    : offerRecipient(entry.offer.worker.firstName, entry.offer.worker.lastInitial);
}

export function OfferRow({
  entry,
  href,
  now,
  current,
}: {
  readonly entry: Entry;
  readonly href: string;
  readonly now: Date;
  /** The Offer open beside the list: it says so, to the eye and to a screen reader. */
  readonly current: boolean;
}) {
  return (
    <Item
      size="sm"
      variant={current ? "muted" : "default"}
      className="min-h-11 items-start"
      render={<Link href={href} aria-current={current ? "page" : undefined} />}
    >
      {/*
        `min-w-0` down the whole chain — the header (a flex item of the row), the
        title (the registry's `w-fit` swapped for `w-auto`) and the heading inside
        it. Any one left at `min-width: auto` reports the whole unbroken name as
        its minimum, and a long name then pushes the time off a 390 px screen and
        scrolls the page sideways. Measured, not predicted.
      */}
      <ItemHeader className="min-w-0 items-baseline">
        <ItemTitle className="w-auto min-w-0">
          <h3 className="text-foreground min-w-0 truncate text-base leading-snug font-medium">
            {counterpartLine(entry)}
          </h3>
        </ItemTitle>
        <time
          dateTime={entry.offer.sentAt.toISOString()}
          className="text-muted-foreground shrink-0 text-xs whitespace-nowrap"
        >
          {sentAgo(entry.offer.sentAt, now)}
        </time>
      </ItemHeader>
      <ItemContent className="min-w-0">
        <ItemDescription>{excerpt(entry.offer.workDescription)}</ItemDescription>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <EntryStateBadge entry={entry} />
          <span className="text-muted-foreground text-sm">{entry.offer.payTerms}</span>
        </span>
        {/* Shut, an accepted row still says the one thing she comes back for is inside. */}
        {entry.exchange ? <span className="text-foreground text-sm">{CONTACT_INSIDE}</span> : null}
      </ItemContent>
    </Item>
  );
}
