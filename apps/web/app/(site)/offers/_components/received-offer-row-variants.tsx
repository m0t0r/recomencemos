/**
 * PROTOTYPE — throwaway. The two rows that disagree with variant A about what
 * leads, and how much of the terms a row carries. The copy is identical across
 * all three: the brief settles the sentences and leaves the composition open.
 */

import type { ReceivedOffer } from "@repo/domain/offers";
import Link from "next/link";
import {
  asReceivedState,
  OFFER_PAY_LABEL,
  OFFER_WHEN_LABEL,
  OFFER_WORK_LABEL,
  offerSentOn,
  OPEN_OFFER_LINK,
  RECEIVED_STATE_SENTENCES,
  senderClaim,
} from "../_lib/messages";
import { OfferStateBadge, OfferTerm } from "./offer-parts";

/** B — who signed it leads, and the three terms are open in full beneath. */
export function ReceivedOfferRowVariantB({ offer }: { readonly offer: ReceivedOffer }) {
  const state = asReceivedState(offer.state);
  if (!state) return null;

  return (
    <li className="border-border flex flex-col gap-3 border-b py-6 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-foreground font-medium">{senderClaim(offer.hirerName)}</p>
          <time dateTime={offer.sentAt.toISOString()} className="text-muted-foreground text-xs">
            {offerSentOn(offer.sentAt)}
          </time>
        </div>
        <OfferStateBadge state={state} className="mt-0.5" />
      </div>

      <dl className="flex flex-col gap-2 text-sm">
        <OfferTerm label={OFFER_WORK_LABEL} value={offer.workDescription} />
        <OfferTerm label={OFFER_PAY_LABEL} value={offer.payTerms} />
        <OfferTerm label={OFFER_WHEN_LABEL} value={offer.whenText} />
      </dl>

      <Link
        href={`/offers/${offer.id}`}
        className="text-foreground text-sm font-medium underline underline-offset-4"
      >
        {OPEN_OFFER_LINK}
      </Link>
    </li>
  );
}

/** C — the pay leads, set as the row's heading line, with the work under it. */
export function ReceivedOfferRowVariantC({ offer }: { readonly offer: ReceivedOffer }) {
  const state = asReceivedState(offer.state);
  if (!state) return null;

  return (
    <li className="border-border flex flex-col gap-2 border-b py-6 last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground text-xs">{RECEIVED_STATE_SENTENCES[state]}</span>
        <OfferStateBadge state={state} />
      </div>

      <p className="text-foreground text-lg leading-snug font-medium whitespace-pre-line">
        {offer.payTerms}
      </p>
      <p className="text-foreground line-clamp-2 text-sm whitespace-pre-line">
        {offer.workDescription}
      </p>
      <p className="text-muted-foreground text-sm">
        {OFFER_WHEN_LABEL}: {offer.whenText}
      </p>

      <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-1 text-sm">
        <span>{senderClaim(offer.hirerName)}</span>
        <Link
          href={`/offers/${offer.id}`}
          className="text-foreground font-medium underline underline-offset-4"
        >
          {OPEN_OFFER_LINK}
        </Link>
      </div>
    </li>
  );
}

/** B's two section headings. PROTOTYPE copy — it goes with B if B loses. */
export const WAITING_SECTION = "Esperan tu respuesta";
export const SETTLED_SECTION = "Ya no esperan respuesta";
