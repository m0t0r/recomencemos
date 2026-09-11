/**
 * **The Offers that reached her, as a summary** — #275's third and fourth
 * sections: what is waiting for her answer, and what closed.
 *
 * **A summary, not a second inbox.** Nothing is decided here: an Offer's terms
 * are what she agrees to, so she answers one where she can read all of it, at
 * `/offers/[id]` (#271 owns that surface). This names who says they wrote, one
 * line of the work, and when — enough to know it is worth opening — and links
 * the list.
 *
 * **The counts are good news, and are styled as text.** A number of people who
 * wrote to her is not an alarm, so there is no badge and no red: the brief's
 * anti-goal, and `DESIGN.md`'s "state is a mark, never a hue".
 *
 * **Every Offer here is one that reached her** — `offers.listReceived` returns
 * only the received states, which is the domain's whitelist rather than this
 * component's filter. Sync and prop-driven, so it renders under happy-dom.
 */

import { buttonVariants } from "@repo/design-system/components/button-variants";
import type { ReceivedOffer, ReceivedOfferState } from "@repo/domain/offers";
import Link from "next/link";
// One set of state names for both surfaces, so the list and this summary cannot
// call the same Offer two different things.
import { RECEIVED_STATE_LABELS } from "@/app/(site)/offers/_lib/messages";
import {
  CLOSED_HEADING,
  closedLine,
  NONE_WAITING,
  OFFERS_HEADING,
  OFFERS_LINK,
  offerArrivedOn,
  senderName,
  waitingCount,
} from "../_lib/messages";

/** How many waiting rows the summary shows before the count and the link say the rest. */
export const WAITING_SHOWN = 3;
/** How many closed lines, newest first. The list holds the whole history. */
export const CLOSED_SHOWN = 5;

type ClosedState = Exclude<ReceivedOfferState, "delivered">;

function isClosed(offer: ReceivedOffer): offer is ReceivedOffer & { state: ClosedState } {
  return offer.state === "accepted" || offer.state === "declined" || offer.state === "expired";
}

export function HerOffers({ offers }: { readonly offers: readonly ReceivedOffer[] }) {
  const waiting = offers.filter((offer) => offer.state === "delivered");
  const closed = offers.filter(isClosed);

  return (
    <>
      <section aria-labelledby="offers-heading" className="flex flex-col gap-3">
        <h2
          id="offers-heading"
          className="font-heading text-foreground text-2xl leading-8 font-medium"
        >
          {OFFERS_HEADING}
        </h2>
        <p className="text-muted-foreground">
          {waiting.length > 0 ? waitingCount(waiting.length) : NONE_WAITING}
        </p>

        {waiting.length > 0 ? (
          <ul className="ruled-page divide-border flex flex-col divide-y">
            {waiting.slice(0, WAITING_SHOWN).map((offer) => (
              <li key={offer.id} className="flex flex-col gap-1 py-3">
                <span className="text-foreground font-medium">{senderName(offer.hirerName)}</span>
                <span className="text-muted-foreground line-clamp-1 text-sm">
                  {offer.workDescription}
                </span>
                <span className="text-muted-foreground text-xs">
                  {offerArrivedOn(offer.sentAt)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        {/* One link for the section: a row is text, so the keyboard is not made to walk every row. */}
        <Link
          href="/offers"
          className={buttonVariants({
            variant: waiting.length > 0 ? "default" : "outline",
            size: "sm",
            className: "self-start",
          })}
        >
          {OFFERS_LINK}
        </Link>
      </section>

      {closed.length > 0 ? (
        <section aria-labelledby="closed-heading" className="flex flex-col gap-3">
          <h2
            id="closed-heading"
            className="font-heading text-foreground text-2xl leading-8 font-medium"
          >
            {CLOSED_HEADING}
          </h2>
          <ul className="flex flex-col gap-1">
            {closed.slice(0, CLOSED_SHOWN).map((offer) => (
              <li key={offer.id} className="text-muted-foreground text-sm">
                {closedLine(offer.hirerName, RECEIVED_STATE_LABELS[offer.state])}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
