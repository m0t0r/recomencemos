/**
 * One Offer he sent: who it went to, where it is, and what he wrote.
 *
 * **The person leads** (`/prototype`, variant B, picked 2026-09-09). He
 * remembers his Offers by who he wrote to rather than by what state they are in,
 * so the nameplate is the scanning anchor and the state is the line beneath it —
 * and the terms are open rather than behind a disclosure, because a tap on a list
 * of five buys nothing.
 *
 * **The state is a badge *and* a sentence.** The badge is what makes four rows
 * scan as four states at a glance; the sentence is what says the thing a label
 * cannot — *normalmente toma menos de un día*, *ahora ella decide*. `voice.md`
 * refuses meaning carried by colour alone and the badge is a text label, so both
 * hold. `_lib/state-badge.ts` carries the argument and the amendment to the
 * brief.
 *
 * **A delayed row gains a line rather than replacing one**, which is the other
 * half of B: *still waiting* and *taking longer than usual* are two facts, and
 * overwriting the first with the second loses the window he was promised.
 *
 * A Server Component. Nothing here is interactive but the link.
 */

import { Badge } from "@repo/design-system/components/badge";
import type { ContactExchange } from "@repo/domain/exchange";
import type { SentOffer } from "@repo/domain/offers";
import Link from "next/link";
import {
  ContactExchangePanel,
  FoldedTerms,
} from "@/app/(site)/_components/contact-exchange/contact-exchange";
import {
  OFFER_PAY_LABEL,
  OFFER_PROFILE_LINK,
  OFFER_REVIEW_DELAYED,
  OFFER_STATE_SENTENCES,
  OFFER_WHEN_LABEL,
  OFFER_WORK_LABEL,
  offerSentOn,
} from "../_lib/messages";
import { offerBadge } from "../_lib/state-badge";

export function SentOfferRow({
  offer,
  exchange,
}: {
  readonly offer: SentOffer;
  /** Present on an accepted row: her details, as he reads them. */
  readonly exchange?: ContactExchange | undefined;
}) {
  const badge = offerBadge(offer.state, offer.reviewDelayed);

  const terms = (
    <dl className="flex flex-col gap-2 text-sm">
      <div>
        <dt className="text-muted-foreground">{OFFER_WORK_LABEL}</dt>
        <dd className="whitespace-pre-line">{offer.workDescription}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">{OFFER_PAY_LABEL}</dt>
        <dd>{offer.payTerms}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">{OFFER_WHEN_LABEL}</dt>
        <dd>{offer.whenText}</dd>
      </div>
    </dl>
  );

  return (
    <li className="border-border flex flex-col gap-3 border-b py-6 last:border-b-0">
      {/*
        The nameplate and the badge on one line: who it went to, and where it is,
        answered together before anything is read.
      */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-foreground font-medium">
            {offer.worker.firstName} {offer.worker.lastInitial}.
          </p>
          <p className="text-muted-foreground truncate text-sm">{offer.worker.headline}</p>
        </div>

        <Badge variant={badge.variant} className="mt-0.5 shrink-0">
          {badge.label}
        </Badge>
      </div>

      {/*
        The sentence the badge cannot carry. Both are here on purpose: the label
        is for the scan and this is for the answer.
      */}
      <p className="text-foreground text-sm">{OFFER_STATE_SENTENCES[offer.state]}</p>
      {offer.reviewDelayed ? (
        <p className="text-foreground text-sm font-medium">{OFFER_REVIEW_DELAYED}</p>
      ) : null}

      {/*
        Accepted: her details on the card, and what he wrote folded beneath it,
        the same shape her row takes. Otherwise the terms, open.
      */}
      {exchange ? (
        <>
          <ContactExchangePanel exchange={exchange} />
          <FoldedTerms side={exchange.side}>{terms}</FoldedTerms>
        </>
      ) : (
        terms
      )}

      <div className="text-muted-foreground flex items-center gap-3 text-xs">
        {/*
          `es-CO` long form, never `08/10/2026` — which reads as August in one
          country and October in another, and this product's two sides are in
          different ones. `dateTime` carries the machine-readable value beside it.
        */}
        <time dateTime={offer.sentAt.toISOString()}>{offerSentOn(offer.sentAt)}</time>
        <Link href={`/profile/${offer.worker.slug}`} className="underline underline-offset-4">
          {OFFER_PROFILE_LINK}
        </Link>
      </div>
    </li>
  );
}
