/**
 * One Offer he sent: who it went to, where it is, and what he wrote.
 *
 * **The state is a sentence in a fixed position**, and past the window it is a
 * different sentence rather than the same one with a colour on it — `voice.md`
 * refuses meaning carried by colour alone, and an alarm about our own queue
 * aimed at the person who cannot act on it is pressure rather than information.
 *
 * **The terms sit behind a native `<details>`.** The page has to be scannable at
 * five rows and it has to answer *what did I actually promise* without a
 * navigation; `<details>` gives both, needs no JavaScript, and carries its own
 * disclosure semantics — which is the reason it is not a button and a piece of
 * state.
 *
 * A Server Component. Nothing here is interactive beyond the disclosure and the
 * link.
 */

import Link from "next/link";
import type { SentOffer } from "@repo/domain/offers";
import {
  OFFER_PAY_LABEL,
  OFFER_PROFILE_LINK,
  OFFER_REVIEW_DELAYED,
  OFFER_STATE_SENTENCES,
  OFFER_TERMS_LABEL,
  OFFER_WHEN_LABEL,
  OFFER_WORK_LABEL,
  offerRecipient,
  offerSentOn,
} from "../_lib/messages";

export function SentOfferRow({ offer }: { readonly offer: SentOffer }) {
  /**
   * **The delayed sentence replaces the waiting one rather than joining it**, so
   * a row says one thing about where its Offer is. `reviewDelayed` is already
   * false for anything a person has read, whatever it took, so this cannot fire
   * on a delivered Offer.
   */
  const state = offer.reviewDelayed ? OFFER_REVIEW_DELAYED : OFFER_STATE_SENTENCES[offer.state];

  return (
    <li className="border-border flex flex-col gap-3 border-b py-5 last:border-b-0">
      <p className="text-foreground font-medium">{state}</p>

      <p className="text-muted-foreground text-sm">
        {offerRecipient(offer.worker.firstName, offer.worker.lastInitial)}{" "}
        <Link href={`/profile/${offer.worker.slug}`} className="underline underline-offset-4">
          {OFFER_PROFILE_LINK}
        </Link>
      </p>

      <details className="text-sm">
        <summary className="text-muted-foreground cursor-pointer">{OFFER_TERMS_LABEL}</summary>

        <dl className="mt-3 flex flex-col gap-2">
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
      </details>

      {/*
        `es-CO` long form, never `08/10/2026` — which reads as August in one
        country and October in another, and this product's two sides are in
        different ones. `dateTime` carries the machine-readable value beside it.
      */}
      <time dateTime={offer.sentAt.toISOString()} className="text-muted-foreground text-xs">
        {offerSentOn(offer.sentAt)}
      </time>
    </li>
  );
}
