/**
 * An opened Offer he sent: where it is, the normal window, what he wrote, and
 * her details once — and only once — she accepted.
 *
 * **The state is a sentence as well as the badge above it.** The badge is for
 * the scan; the sentence says what a label has no room for — _normalmente toma
 * menos de un día_, _ahora ella decide_. **A delayed review gains a line rather
 * than replacing one**: _still waiting_ and _taking longer than usual_ are two
 * facts, and overwriting the first loses the window he was promised. The words
 * are the ones #24 settled, unchanged.
 *
 * **No detail of hers unless an exchange crossed.** `SentOffer` carries her
 * `PublicProfile`-shaped identity and nothing more, and this reaches around
 * nothing: her details arrive only through the exchange read.
 */

import type { ContactExchange } from "@repo/domain/exchange";
import type { SentOffer } from "@repo/domain/offers";
import Link from "next/link";
import {
  ContactExchangePanel,
  FoldedTerms,
} from "@/app/(site)/_components/contact-exchange/contact-exchange";
import {
  OFFER_PROFILE_LINK,
  OFFER_REVIEW_DELAYED,
  OFFER_STATE_SENTENCES,
  offerSentOn,
} from "../_lib/sent-messages";
import { OfferTerms } from "./offer-parts";

export function SentOfferBody({
  offer,
  exchange,
}: {
  readonly offer: SentOffer;
  /** Present once accepted: her details, as he reads them. */
  readonly exchange?: ContactExchange | undefined;
}) {
  const terms = (
    <>
      <OfferTerms offer={offer} />

      <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 text-sm">
        {/*
          `es-CO` long form, never `08/10/2026` — which reads as August in one
          country and October in another, and this product's two sides are in
          different ones.
        */}
        <time dateTime={offer.sentAt.toISOString()}>{offerSentOn(offer.sentAt)}</time>
        {/* A 44 px target: the critique measured this link at 65 × 16. */}
        <Link
          href={`/profile/${offer.worker.slug}`}
          className="text-foreground inline-flex min-h-11 items-center underline underline-offset-4"
        >
          {OFFER_PROFILE_LINK}
        </Link>
      </div>
    </>
  );

  return (
    <div className="flex flex-col gap-5">
      <p className="text-foreground text-sm">{OFFER_STATE_SENTENCES[offer.state]}</p>
      {offer.reviewDelayed ? (
        <p className="text-foreground text-sm font-medium">{OFFER_REVIEW_DELAYED}</p>
      ) : null}

      {exchange ? (
        <>
          <ContactExchangePanel exchange={exchange} />
          <FoldedTerms side={exchange.side}>{terms}</FoldedTerms>
        </>
      ) : (
        terms
      )}
    </div>
  );
}
