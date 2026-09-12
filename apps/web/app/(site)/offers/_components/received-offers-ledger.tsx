/**
 * Every Offer that has reached her, newest first, as ruled rows in one
 * notebook — or the empty state (#271, the UX lab's variant A, _El cuaderno_).
 *
 * **One list, not a waiting pile above an answered one.** Each row says where it
 * stands in words, so sorting them into sections would only be the platform
 * deciding which of her Offers matter. An answered row stays, saying what she
 * answered: a decision she made is one she can come back and read.
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
import Link from "next/link";
import { CountAnnouncement } from "@/app/(site)/_components/profile-list/count-announcement";
import type { LedgerView } from "../_lib/ledger";
import {
  RECEIVED_OFFERS_EMPTY_BODY,
  RECEIVED_OFFERS_EMPTY_HEADING,
  RECEIVED_OFFERS_EMPTY_LINK,
  RECEIVED_OFFERS_NO_PROFILE_BODY,
  RECEIVED_OFFERS_NO_PROFILE_LINK,
  receivedOffersCount,
} from "../_lib/messages";
import { LedgerRow } from "./ledger-row";

export function ReceivedOffersLedger({ offers, hasProfile, now, open }: LedgerView) {
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
      </div>
    );
  }

  return (
    <>
      {/*
        The sentence rather than the formatter: `CountAnnouncement` is a Client
        Component and a function cannot cross that boundary.
      */}
      <CountAnnouncement count={offers.length} label={receivedOffersCount(offers.length)} />
      {/* `DESIGN.md` → Layout: every list is a ruled page, rows divided by the ruling. */}
      <ul className="ruled-page">
        {offers.map((offer, index) => (
          <LedgerRow
            key={offer.id}
            offer={offer}
            now={now}
            separated={index > 0}
            opened={offer.id === open?.id ? open : undefined}
          />
        ))}
      </ul>
    </>
  );
}
