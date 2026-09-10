/**
 * The list itself: every Offer that has reached her, newest first, or the empty
 * state.
 *
 * **The empty state says what makes an Offer arrive and that a person reads each
 * one first** — both clauses of the spec's cell — and routes to the thing an
 * Offer is addressed to: her profile, or publishing one.
 *
 * The count is announced once when the boundary resolves rather than per row —
 * the rule the Wall, `/profiles` and `/sent-offers` follow, through the same
 * component.
 */

import { buttonVariants } from "@repo/design-system/components/button-variants";
import type { ReceivedOffer } from "@repo/domain/offers";
import Link from "next/link";
import { CountAnnouncement } from "@/app/(site)/_components/profile-list/count-announcement";
import { PrototypeSwitcher } from "@/app/_components/prototype-switcher";
import { type PrototypeVariant, variantFrom } from "@/app/_lib/prototype-variants";
import {
  RECEIVED_OFFERS_EMPTY_BODY,
  RECEIVED_OFFERS_EMPTY_HEADING,
  RECEIVED_OFFERS_EMPTY_LINK,
  RECEIVED_OFFERS_NO_PROFILE_BODY,
  RECEIVED_OFFERS_NO_PROFILE_LINK,
  receivedOffersCount,
} from "../_lib/messages";
import { ReceivedOfferRow } from "./received-offer-row";
import {
  ReceivedOfferRowVariantB,
  ReceivedOfferRowVariantC,
  SETTLED_SECTION,
  WAITING_SECTION,
} from "./received-offer-row-variants";

/** PROTOTYPE — throwaway, with the variants. */
const VARIANTS: readonly PrototypeVariant[] = [
  { key: "a", name: "El trabajo primero" },
  { key: "b", name: "Por responder arriba" },
  { key: "c", name: "El pago a la vista" },
];

export function ReceivedOfferList({
  offers,
  hasProfile,
  variant: rawVariant,
}: {
  readonly offers: readonly ReceivedOffer[];
  readonly hasProfile: boolean;
  /** PROTOTYPE — throwaway, with the variants. */
  readonly variant?: string | undefined;
}) {
  const variant = variantFrom(rawVariant, VARIANTS);
  const switcher = <PrototypeSwitcher variants={VARIANTS} current={variant} />;

  if (offers.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3">
        <h2 className="text-lg font-medium">{RECEIVED_OFFERS_EMPTY_HEADING}</h2>
        <p className="text-muted-foreground">
          {hasProfile ? RECEIVED_OFFERS_EMPTY_BODY : RECEIVED_OFFERS_NO_PROFILE_BODY}
        </p>
        {/* Link text names its destination — never `aquí`. */}
        <Link
          href={hasProfile ? "/my-profile" : "/publish"}
          className={buttonVariants({ variant: "outline" })}
        >
          {hasProfile ? RECEIVED_OFFERS_EMPTY_LINK : RECEIVED_OFFERS_NO_PROFILE_LINK}
        </Link>
        {switcher}
      </div>
    );
  }

  const announcement = (
    <CountAnnouncement count={offers.length} label={receivedOffersCount(offers.length)} />
  );

  if (variant === "b") {
    const waiting = offers.filter((offer) => offer.state === "delivered");
    const settled = offers.filter((offer) => offer.state !== "delivered");

    return (
      <>
        {announcement}
        {[
          { heading: WAITING_SECTION, rows: waiting },
          { heading: SETTLED_SECTION, rows: settled },
        ]
          .filter((section) => section.rows.length > 0)
          .map((section) => (
            <section key={section.heading} className="flex flex-col gap-1">
              <h2 className="text-muted-foreground text-sm font-medium">{section.heading}</h2>
              <ul className="flex flex-col">
                {section.rows.map((offer) => (
                  <ReceivedOfferRowVariantB key={offer.id} offer={offer} />
                ))}
              </ul>
            </section>
          ))}
        {switcher}
      </>
    );
  }

  const Row = variant === "c" ? ReceivedOfferRowVariantC : ReceivedOfferRow;

  return (
    <>
      {announcement}
      <ul className="flex flex-col">
        {offers.map((offer) => (
          <Row key={offer.id} offer={offer} />
        ))}
      </ul>
      {switcher}
    </>
  );
}
