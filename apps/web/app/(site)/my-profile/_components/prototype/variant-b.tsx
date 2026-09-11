/**
 * PROTOTYPE — variant B, "Compacta". Throwaway; never ships.
 *
 * Bet: on a phone she scrolls less if the card is a row rather than a sheet,
 * and the two private tiers are a question she asks sometimes, not every day —
 * so they fold into native `<details>` (which open without JavaScript) under one
 * heading. Order unchanged: where she stands, her card, the Offers, what closed,
 * then who sees what.
 */

import { buttonVariants } from "@repo/design-system/components/button-variants";
import { cityLabel } from "@repo/domain/policy";
import Link from "next/link";
import { displayName, initialOf } from "@/app/(site)/_components/profile-card";
import { HerOffers } from "../her-offers";
import {
  ArrivalConfirmation,
  GatedTerms,
  HeldTerms,
  type OwnProfileViewProps,
  PHOTO_SENTENCE_ID,
  photoSentence,
  Standing,
} from "../own-profile-view";
import { PhotoControl } from "../photo-control";
import { EDIT_LINK, GATED_HEADING, HELD_EXPLANATION, HELD_HEADING } from "../../_lib/messages";

const heading = "font-heading text-foreground text-2xl leading-8 font-medium";

export function VariantB({ profile, offers, arrival }: OwnProfileViewProps) {
  return (
    <div className="flex flex-col gap-8">
      {arrival ? <ArrivalConfirmation arrival={arrival} /> : null}

      <Standing profile={profile} />

      <section aria-labelledby="b-card" className="flex flex-col gap-3">
        <h2 id="b-card" className={heading}>
          Así te ven
        </h2>
        <div className="flex items-start gap-4">
          <PhotoControl
            currentUrl={profile.photoUrl}
            initial={initialOf(profile.firstName)}
            describedBy={PHOTO_SENTENCE_ID}
            size="sm"
          />
          <div className="flex min-w-0 flex-col gap-1">
            <p className="font-heading text-foreground text-xl leading-7 text-pretty">
              {profile.headline}
            </p>
            <p className="text-muted-foreground text-sm">
              {displayName(profile.firstName, profile.lastInitial)} · {cityLabel(profile.city)}
            </p>
            <p className="text-muted-foreground text-sm">
              {profile.skills.map((skill) => skill.labelEs).join(" · ")}
            </p>
          </div>
        </div>
        <p id={PHOTO_SENTENCE_ID} className="text-muted-foreground text-sm">
          {photoSentence(profile.photoState)}
        </p>
        <Link
          href="/my-profile/edit"
          className={buttonVariants({ variant: "outline", size: "sm", className: "self-start" })}
        >
          {EDIT_LINK}
        </Link>
      </section>

      <HerOffers offers={offers} />

      <section aria-labelledby="b-tiers" className="flex flex-col">
        <h2 id="b-tiers" className={`${heading} pb-2`}>
          Qué ve cada quien
        </h2>
        <details className="border-border border-t py-3">
          <summary className="text-foreground cursor-pointer font-medium">{GATED_HEADING}</summary>
          <div className="pt-3">
            <GatedTerms profile={profile} />
          </div>
        </details>
        <details className="border-border border-y py-3">
          <summary className="text-foreground cursor-pointer font-medium">{HELD_HEADING}</summary>
          <div className="flex flex-col gap-3 pt-3">
            <p className="text-muted-foreground text-sm text-pretty">{HELD_EXPLANATION}</p>
            <HeldTerms profile={profile} />
          </div>
        </details>
      </section>
    </div>
  );
}
