/**
 * One Offer she has received: what it asks, what it pays, when, where it
 * stands, and who signed it.
 *
 * **The work leads** (variant A, pending the pick). It is what the Hirer wrote
 * first and it is the question she has first — _what is this asking of me_ —
 * so it is the scanning anchor, cut to three lines here and in full on the
 * Offer's own page.
 *
 * **No decision control.** The row summarises; the answer is taken on the page
 * that holds the whole Offer, because what she agrees to is what she can see.
 */

import type { ReceivedOffer } from "@repo/domain/offers";
import Link from "next/link";
import {
  asReceivedState,
  OFFER_PAY_LABEL,
  OFFER_WHEN_LABEL,
  offerSentOn,
  OPEN_OFFER_LINK,
  RECEIVED_STATE_SENTENCES,
  senderClaim,
} from "../_lib/messages";
import { OfferStateBadge, OfferTerm } from "./offer-parts";

export function ReceivedOfferRow({ offer }: { readonly offer: ReceivedOffer }) {
  // The read only returns received states; this narrows the type and refuses
  // to render anything the read should not have handed over.
  const state = asReceivedState(offer.state);
  if (!state) return null;

  return (
    <li className="border-border flex flex-col gap-3 border-b py-6 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <p className="text-foreground line-clamp-3 font-medium whitespace-pre-line">
          {offer.workDescription}
        </p>
        <OfferStateBadge state={state} className="mt-0.5" />
      </div>

      <p className="text-foreground text-sm">{RECEIVED_STATE_SENTENCES[state]}</p>

      <dl className="flex flex-col gap-2 text-sm">
        <OfferTerm label={OFFER_PAY_LABEL} value={offer.payTerms} />
        <OfferTerm label={OFFER_WHEN_LABEL} value={offer.whenText} />
      </dl>

      <p className="text-muted-foreground text-sm">{senderClaim(offer.hirerName)}</p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link
          href={`/offers/${offer.id}`}
          className="text-foreground text-sm font-medium underline underline-offset-4"
        >
          {OPEN_OFFER_LINK}
        </Link>
        {/* `es-CO` long form; `dateTime` carries the machine-readable value. */}
        <time dateTime={offer.sentAt.toISOString()} className="text-muted-foreground text-xs">
          {offerSentOn(offer.sentAt)}
        </time>
      </div>
    </li>
  );
}
