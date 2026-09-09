/**
 * The list itself: every Offer he has sent, newest first, or the empty state.
 *
 * **The empty state routes into `/profiles` and reads as a good state**, which
 * is the spec's own cell for this surface. Nobody has failed at anything by not
 * having written to somebody yet.
 *
 * The count is announced once when the boundary resolves rather than per row —
 * the rule the Wall and the browsable list already follow, through the same
 * component.
 */

import type { SentOffer } from "@repo/domain/offers";
import { buttonVariants } from "@repo/design-system/components/button-variants";
import Link from "next/link";
import { CountAnnouncement } from "@/app/(site)/_components/profile-list/count-announcement";
import {
  SENT_OFFERS_EMPTY_BODY,
  SENT_OFFERS_EMPTY_HEADING,
  SENT_OFFERS_EMPTY_LINK,
  sentOffersCount,
} from "../_lib/messages";
import { SentOfferRow } from "./sent-offer-row";
import { SentOfferRowVariantB, SentOfferRowVariantC } from "./sent-offer-row-variants";

export function SentOfferList({
  offers,
  variant = "a",
}: {
  readonly offers: readonly SentOffer[];
  /** PROTOTYPE — throwaway, with the variants. */
  readonly variant?: string;
}) {
  if (offers.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3">
        <h2 className="text-lg font-medium">{SENT_OFFERS_EMPTY_HEADING}</h2>
        <p className="text-muted-foreground">{SENT_OFFERS_EMPTY_BODY}</p>
        {/* Link text names its destination — never `aquí`. */}
        <Link href="/profiles" className={buttonVariants({ variant: "default" })}>
          {SENT_OFFERS_EMPTY_LINK}
        </Link>
      </div>
    );
  }

  return (
    <>
      {/*
        The sentence rather than the formatter: `CountAnnouncement` is a Client
        Component and a function cannot cross that boundary. See its own props.
      */}
      <CountAnnouncement count={offers.length} label={sentOffersCount(offers.length)} />
      {/* PROTOTYPE — throwaway. Same copy in all three; the shape is the question. */}
      <ul className="flex flex-col">
        {offers.map((offer) =>
          variant === "b" ? (
            <SentOfferRowVariantB key={offer.id} offer={offer} />
          ) : variant === "c" ? (
            <SentOfferRowVariantC key={offer.id} offer={offer} />
          ) : (
            <SentOfferRow key={offer.id} offer={offer} />
          ),
        )}
      </ul>
    </>
  );
}
