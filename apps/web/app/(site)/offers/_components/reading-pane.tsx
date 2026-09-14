/**
 * The Offer she opened: beside the list from `lg` up, and on the phone a screen
 * of its own with the way back to the list above it.
 *
 * **Server-rendered at a real path.** `/offers/<id>` is what the delivery email
 * links to and what every row is a link to, so the opened Offer is in the
 * document before any script runs — not a fragment, and not a panel a click
 * fills in.
 *
 * **The heading says who, as each side has always said it.** Received, the
 * name is his claim — _Firma como Carlos Restrepo_ — and _Aquí no verificamos a
 * nadie_ comes before the name again inside, beside the decision it bears on.
 * Sent, it is who it went to, _Para Ana María R._, with her headline under it.
 */

import { buttonVariants } from "@repo/design-system/components/button-variants";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import type { Entry, MailboxPage } from "../_lib/mailbox-view";
import { backTo, rowSignature, sentAgo } from "../_lib/messages";
import { offerRecipient } from "../_lib/sent-messages";
import { EntryStateBadge } from "./entry-state-badge";
import { PaneHeading } from "./pane-heading";
import { ReceivedOfferBody } from "./received-offer";
import { SentOfferBody } from "./sent-offer";

export function ReadingPane({
  entry,
  view,
  query,
}: {
  readonly entry: Entry;
  readonly view: MailboxPage;
  /** The folder's query, so _Volver a …_ returns to the list she came from. */
  readonly query: string;
}) {
  const headingId = `offer-heading-${entry.offer.id}`;
  // After an answer the result takes focus instead of the heading.
  const focusHeading = view.arrival === undefined && view.justAccepted !== true;

  return (
    <article aria-labelledby={headingId} className="flex flex-col gap-5">
      {/* The phone's way back to the list. From `lg` up the list is beside it. */}
      <Link
        href={`/offers${query}`}
        className={buttonVariants({ variant: "ghost", className: "min-h-11 self-start lg:hidden" })}
      >
        <ArrowLeftIcon aria-hidden="true" />
        {backTo(view)}
      </Link>

      <header className="flex flex-col gap-2">
        <PaneHeading id={headingId} focusOnMount={focusHeading}>
          {entry.direction === "received"
            ? rowSignature(entry.offer.hirerName)
            : offerRecipient(entry.offer.worker.firstName, entry.offer.worker.lastInitial)}
        </PaneHeading>
        {entry.direction === "sent" ? (
          <p className="text-muted-foreground text-sm">{entry.offer.worker.headline}</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <EntryStateBadge entry={entry} />
          <time
            dateTime={entry.offer.sentAt.toISOString()}
            className="text-muted-foreground text-sm"
          >
            {sentAgo(entry.offer.sentAt, view.now)}
          </time>
        </div>
      </header>

      {entry.direction === "received" ? (
        <ReceivedOfferBody
          offer={entry.offer}
          exchange={entry.exchange}
          arrival={view.arrival}
          justAccepted={view.justAccepted === true}
        />
      ) : (
        <SentOfferBody offer={entry.offer} exchange={entry.exchange} />
      )}
    </article>
  );
}
