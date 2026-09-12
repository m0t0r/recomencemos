/**
 * The Contact Exchange, as one party reads it: a card leading the accepted row
 * with the other side's three details, each beside a _Copiar_; what the reader
 * gave; and where the copy by email is. The terms it crossed for fold beneath
 * it, in {@link FoldedTerms}.
 *
 * **The details lead, large, each with the one act she will take with it.**
 * She comes back to this row for a number to put into a phone, so the number is
 * the first thing in it and _Copiar_ is beside it; `.impeccable/briefs/contact-exchange.md`
 * is the shape it answers to.
 *
 * **One component for both readers**, because it is one event seen from two
 * sides — her accepted row at `/offers` and his at `/sent-offers`. What differs
 * by side is copy, and `messages.ts` carries it keyed on the side the domain
 * decided; nothing here re-derives which side the reader is on.
 *
 * **The details are text, never `tel:` or `mailto:` links.** A link built from
 * what a stranger typed is an `href` derived from user text, which DD7 and DD14
 * refuse on the page as in the mail. Copying is the reader's act.
 *
 * **A Server Component.** The client pieces are `arrival.tsx`, which does
 * nothing unless this render followed her answer, and `copy-detail.tsx`.
 */

import { Card, CardContent, CardHeader } from "@repo/design-system/components/card";
import type { ContactExchange, ExchangeSide } from "@repo/domain/exchange";
import { formatColombianPhone } from "@repo/domain/policy";
import * as React from "react";
import { AnnouncedDetails, ExchangeHeading } from "./arrival";
import { CopyDetail } from "./copy-detail";
import {
  COPY_LINES,
  EXCHANGE_CLAIM,
  EXCHANGE_HEADING,
  EXCHANGE_LABELS,
  EXCHANGE_LEAD,
  FOLDED_TERMS,
  NO_NAME,
  NO_PHONE,
  ownGiven,
} from "./messages";

/**
 * One detail, large, with its _Copiar_ inside the `dd` — `dl`'s content model
 * allows a `div` grouping one `dt` and its `dd`s, and no other wrapper.
 *
 * `shown` is what she reads and `copied` is what reaches her clipboard — they
 * differ only for the phone, which is read in the national form and copied with
 * its country code. A detail he did not give has nothing to copy, so `copied` is
 * `null` and there is no button.
 */
function Detail({
  label,
  shown,
  copied,
}: {
  readonly label: string;
  readonly shown: string;
  readonly copied: string | null;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="flex items-center justify-between gap-3">
        <span className="text-foreground min-w-0 text-xl font-medium break-words">{shown}</span>
        {copied === null ? null : <CopyDetail value={copied} label={label} />}
      </dd>
    </div>
  );
}

export function ContactExchangePanel({
  exchange,
  justAccepted = false,
}: {
  readonly exchange: ContactExchange;
  /** The render that followed her answer: focus the heading and announce the details. */
  readonly justAccepted?: boolean;
}) {
  const { side, counterpart, own } = exchange;
  const labels = EXCHANGE_LABELS[side];
  // Unique per row: a list renders one of these per accepted Offer.
  const headingId = `contact-exchange-${exchange.offerId}`;

  return (
    // The registry `Card` is a `div`, so the named region is the `section`
    // around it — which is what a screen-reader user lists and lands on.
    <section aria-labelledby={headingId}>
      <Card size="sm">
        <CardHeader>
          <ExchangeHeading id={headingId} focusOnMount={justAccepted}>
            {EXCHANGE_HEADING[side]}
          </ExchangeHeading>
        </CardHeader>

        <CardContent className="gap-4">
          <AnnouncedDetails announce={justAccepted}>
            <dl className="flex flex-col gap-4">
              <Detail
                label={labels.name}
                shown={counterpart.fullName ?? NO_NAME}
                copied={counterpart.fullName}
              />
              <Detail
                label={labels.phone}
                shown={counterpart.phone ? formatColombianPhone(counterpart.phone) : NO_PHONE}
                copied={counterpart.phone}
              />
              <Detail label={labels.email} shown={counterpart.email} copied={counterpart.email} />
            </dl>
          </AnnouncedDetails>

          <p className="text-muted-foreground text-sm">{EXCHANGE_CLAIM[side]}</p>
          <p className="text-foreground text-sm">{COPY_LINES[exchange.copy]}</p>
          <p className="text-muted-foreground text-sm">{ownGiven(side, own)}</p>
          <p className="text-foreground text-base">{EXCHANGE_LEAD}</p>
        </CardContent>
      </Card>
    </section>
  );
}

/**
 * **The terms, folded under the card.** Once the details have crossed, what she
 * reads the row for is the number; the work, the pay and the when are what she
 * agreed to, one tap away rather than gone.
 *
 * **A native `<details>`**, for the ledger row's own reason: it opens without
 * JavaScript and before hydration.
 */
export function FoldedTerms({
  side,
  children,
}: {
  readonly side: ExchangeSide;
  readonly children: React.ReactNode;
}) {
  return (
    <details className="border-border border-t pt-3">
      <summary className="text-muted-foreground cursor-pointer text-sm">
        {FOLDED_TERMS[side]}
      </summary>
      <div className="flex flex-col gap-5 pt-3">{children}</div>
    </details>
  );
}
