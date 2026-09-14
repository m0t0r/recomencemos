/**
 * An opened Offer that reached her: the result of her answer if she just gave
 * one, where it stands, what it asks, who claims to have sent it, and — while it
 * waits on her — her answer, at its foot.
 *
 * **The order is the decision's.** What she agrees to and who claims to be
 * asking come before the buttons, so everything she is deciding on is above the
 * control that decides it. The words are the ones #271 settled, unchanged.
 *
 * **Accepted, the card leads** — she comes back for a number — and the terms it
 * crossed for fold beneath it.
 */

import type { ContactExchange } from "@repo/domain/exchange";
import type { ReceivedOffer } from "@repo/domain/offers";
import {
  ContactExchangePanel,
  FoldedTerms,
} from "@/app/(site)/_components/contact-exchange/contact-exchange";
import {
  offerSentOn,
  RECEIVED_STATE_SENTENCES,
  SENDER_ABSENCE,
  SENDER_LABEL,
  SENDER_NAMED_NOTE,
  SENDER_UNNAMED,
} from "../_lib/messages";
import { asReceivedState } from "../_lib/received-state";
import { AnswerControls } from "./answer-controls";
import { ArrivalStatus } from "./arrival-status";
import { OfferTerms } from "./offer-parts";

/**
 * Who claims to be asking. **The absence leads, whether or not there is a
 * name** — she reads that nobody here is verified before she reads who says
 * they wrote this.
 */
function Sender({ offerId, hirerName }: { offerId: string; hirerName: string | null }) {
  const headingId = `offer-sender-${offerId}`;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-1">
      <h3 id={headingId} className="text-muted-foreground text-sm">
        {SENDER_LABEL}
      </h3>
      <p className="text-muted-foreground text-sm">{SENDER_ABSENCE}</p>
      <p className="text-foreground font-medium">{hirerName ?? SENDER_UNNAMED}</p>
      {hirerName === null ? null : (
        <p className="text-muted-foreground text-sm">{SENDER_NAMED_NOTE}</p>
      )}
    </section>
  );
}

export function ReceivedOfferBody({
  offer,
  exchange,
  arrival,
  justAccepted,
}: {
  readonly offer: ReceivedOffer;
  /** Present once accepted: what crossed, as she reads it. */
  readonly exchange?: ContactExchange | undefined;
  /** The sentence an answer landed with. */
  readonly arrival?: string | undefined;
  /** This render followed her acceptance. */
  readonly justAccepted: boolean;
}) {
  // The read only returns received states; this refuses to render anything else.
  const state = asReceivedState(offer.state);
  if (!state) return null;

  // Right after she accepts, the Contact Exchange's heading takes focus and its
  // details are announced — so the arrival sentence does not also ask to.
  const exchangeAnnounces = exchange !== undefined && justAccepted;

  const terms = (
    <>
      <OfferTerms offer={offer} />

      {/* `es-CO` long form; `dateTime` carries the machine-readable value. */}
      <time dateTime={offer.sentAt.toISOString()} className="text-muted-foreground text-xs">
        {offerSentOn(offer.sentAt)}
      </time>

      <Sender offerId={offer.id} hirerName={offer.hirerName} />
    </>
  );

  return (
    <div className="flex flex-col gap-5">
      {/*
        The result of her answer, focused so it is heard. The state line after it
        is what stays on every later visit.
      */}
      {arrival && !exchangeAnnounces ? <ArrivalStatus>{arrival}</ArrivalStatus> : null}

      <p className="text-foreground text-sm">{RECEIVED_STATE_SENTENCES[state]}</p>

      {exchange ? (
        <>
          <ContactExchangePanel exchange={exchange} justAccepted={exchangeAnnounces} />
          <FoldedTerms side={exchange.side}>{terms}</FoldedTerms>
        </>
      ) : (
        terms
      )}

      {/* Only while there is an answer to give; an answered Offer has its state above. */}
      {state === "delivered" ? (
        <AnswerControls offerId={offer.id} hirerName={offer.hirerName} />
      ) : null}
    </div>
  );
}
