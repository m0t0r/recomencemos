/**
 * PROTOTYPE — throwaway. Two alternative row compositions, for `?variant=b` and
 * `?variant=c`. Variant A is the real `SentOfferRow`.
 *
 * They disagree about the three things `.impeccable/briefs/sent-offers.md`
 * leaves `[open]`, together rather than one axis at a time:
 *
 * | | The row's shape | Where the terms sit | How a delayed row differs |
 * | --- | --- | --- | --- |
 * | **A** | State-led, her identity beneath | Behind a native `<details>` | A different sentence in the same position |
 * | **B** | Her identity leads, state beneath | Always visible | An extra line under the state |
 * | **C** | Two columns — who and when, against state and terms | Always visible, in the right column | The row's own weight, as a left rule |
 *
 * **The copy is identical in all three**, which is the point: the brief settles
 * the sentences and leaves the composition open, so a variant that reworded the
 * delayed state would be answering a question already answered.
 *
 * Server Components. Nothing here is interactive beyond the disclosure and the
 * link, exactly as the real row is.
 */

import type { SentOffer } from "@repo/domain/offers";
import Link from "next/link";
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

function stateOf(offer: SentOffer): string {
  return offer.reviewDelayed ? OFFER_REVIEW_DELAYED : OFFER_STATE_SENTENCES[offer.state];
}

function Terms({ offer }: { readonly offer: SentOffer }) {
  return (
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
}

/**
 * **B — the person leads.**
 *
 * A nameplate first, the state as a line beneath it, and the terms always open.
 * The claim is that he remembers his Offers by *who he wrote to* rather than by
 * what state they are in, so scanning for a person is the faster read — and that
 * a disclosure on a list of five is a tap that buys nothing.
 *
 * A delayed row gains an extra line rather than replacing the state sentence, so
 * "still waiting" and "taking longer than usual" are two facts rather than one
 * that overwrites the other.
 */
export function SentOfferRowVariantB({ offer }: { readonly offer: SentOffer }) {
  return (
    <li className="border-border flex flex-col gap-3 border-b py-5 last:border-b-0">
      <div className="flex flex-col gap-0.5">
        <p className="text-foreground font-medium">
          {offer.worker.firstName} {offer.worker.lastInitial}.
        </p>
        <p className="text-muted-foreground text-sm">{offer.worker.headline}</p>
      </div>

      <p className="text-foreground text-sm">{OFFER_STATE_SENTENCES[offer.state]}</p>
      {offer.reviewDelayed ? (
        <p className="text-foreground text-sm font-medium">{OFFER_REVIEW_DELAYED}</p>
      ) : null}

      <Terms offer={offer} />

      <div className="text-muted-foreground flex items-center gap-3 text-xs">
        <time dateTime={offer.sentAt.toISOString()}>{offerSentOn(offer.sentAt)}</time>
        <Link href={`/profile/${offer.worker.slug}`} className="underline underline-offset-4">
          {OFFER_PROFILE_LINK}
        </Link>
      </div>
    </li>
  );
}

/**
 * **C — two columns.**
 *
 * Who and when on the left, what is happening and what he promised on the right;
 * on a phone the two stack and the reading order is unchanged. The claim is that
 * a list of five Offers is a table, and that a table is what lets him compare
 * rows rather than read each one.
 *
 * A delayed row carries a left rule and no extra sentence — the weight is the
 * marker. **The sentence is still there**, because `voice.md` refuses meaning
 * carried by position or colour alone; what the rule adds is scannability, not
 * the fact.
 */
export function SentOfferRowVariantC({ offer }: { readonly offer: SentOffer }) {
  return (
    <li
      className={`border-border grid gap-3 border-b py-5 last:border-b-0 sm:grid-cols-[10rem_1fr] ${
        offer.reviewDelayed ? "border-l-foreground border-l-2 pl-4" : ""
      }`}
    >
      <div className="flex flex-col gap-0.5">
        <p className="text-foreground text-sm font-medium">
          {offerRecipient(offer.worker.firstName, offer.worker.lastInitial)}
        </p>
        <time dateTime={offer.sentAt.toISOString()} className="text-muted-foreground text-xs">
          {offerSentOn(offer.sentAt)}
        </time>
        <Link
          href={`/profile/${offer.worker.slug}`}
          className="text-muted-foreground text-xs underline underline-offset-4"
        >
          {OFFER_PROFILE_LINK}
        </Link>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-foreground font-medium">{stateOf(offer)}</p>
        <p className="text-muted-foreground text-xs">{OFFER_TERMS_LABEL}</p>
        <Terms offer={offer} />
      </div>
    </li>
  );
}
