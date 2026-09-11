/**
 * PROTOTYPE — variant C, "Renglones". Throwaway; never ships.
 *
 * Bet: her side is a page in the notebook, not a stack of sheets — one ruled
 * ledger, each row a label, what is true, and the one thing she can do about
 * it at the right edge. No cards at all; the ruling is the structure. Order
 * unchanged: where she stands, her photo and line, the Offers, what closed,
 * then who sees what, folded.
 */

import { cityLabel } from "@repo/domain/policy";
import type { ReceivedOffer } from "@repo/domain/offers";
import Link from "next/link";
import type { ReactNode } from "react";
import { displayName, initialOf } from "@/app/(site)/_components/profile-card";
import { RECEIVED_STATE_LABELS } from "@/app/(site)/offers/_lib/messages";
import {
  ArrivalConfirmation,
  GatedTerms,
  HeldTerms,
  type OwnProfileViewProps,
  PHOTO_SENTENCE_ID,
  photoSentence,
} from "../own-profile-view";
import { PauseSwitch } from "../pause-switch";
import { PhotoControl } from "../photo-control";
import {
  closedLine,
  EDIT_LINK,
  GATED_HEADING,
  HELD_EXPLANATION,
  HELD_HEADING,
  NONE_WAITING,
  OFFERS_LINK,
  PAUSED_EXPLANATION,
  pausedSince,
  VISIBLE_LINE,
  waitingCount,
} from "../../_lib/messages";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <li className="flex flex-col gap-2 py-4">
      <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {label}
      </span>
      {children}
    </li>
  );
}

const textLink = "text-primary text-sm font-medium underline underline-offset-4";

function isClosed(offer: ReceivedOffer): offer is ReceivedOffer & {
  state: "accepted" | "declined" | "expired";
} {
  return offer.state === "accepted" || offer.state === "declined" || offer.state === "expired";
}

export function VariantC({ profile, offers, arrival }: OwnProfileViewProps) {
  const waiting = offers.filter((offer) => offer.state === "delivered");
  const closed = offers.filter(isClosed);

  return (
    <div className="flex flex-col gap-6">
      {arrival ? <ArrivalConfirmation arrival={arrival} /> : null}

      <ul className="ruled-page divide-border flex flex-col divide-y">
        {profile.takenDown ? null : (
          <Row label="En el sitio">
            <p className="text-foreground text-pretty">
              {profile.pausedAt ? pausedSince(profile.pausedAt) : VISIBLE_LINE}
            </p>
            {profile.pausedAt ? (
              <p className="text-muted-foreground text-sm">{PAUSED_EXPLANATION}</p>
            ) : null}
            <PauseSwitch paused={profile.pausedAt !== null} />
          </Row>
        )}

        <Row label="Así te ven">
          <div className="flex items-start gap-4">
            <PhotoControl
              currentUrl={profile.photoUrl}
              initial={initialOf(profile.firstName)}
              describedBy={PHOTO_SENTENCE_ID}
              size="sm"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="font-heading text-foreground text-lg leading-6 text-pretty">
                {profile.headline}
              </p>
              <p className="text-muted-foreground text-sm">
                {displayName(profile.firstName, profile.lastInitial)} · {cityLabel(profile.city)}
              </p>
              <p id={PHOTO_SENTENCE_ID} className="text-muted-foreground text-xs">
                {photoSentence(profile.photoState)}
              </p>
            </div>
          </div>
          <Link href="/my-profile/edit" className={textLink}>
            {EDIT_LINK}
          </Link>
        </Row>

        <Row label="Propuestas">
          <p className="text-foreground">
            {waiting.length > 0 ? waitingCount(waiting.length) : NONE_WAITING}
          </p>
          <Link href="/offers" className={textLink}>
            {OFFERS_LINK}
          </Link>
        </Row>

        {closed.length > 0 ? (
          <Row label="Cerradas">
            <ul className="flex flex-col gap-1">
              {closed.slice(0, 5).map((offer) => (
                <li key={offer.id} className="text-muted-foreground text-sm">
                  {closedLine(offer.hirerName, RECEIVED_STATE_LABELS[offer.state])}
                </li>
              ))}
            </ul>
          </Row>
        ) : null}

        <li className="py-4">
          <details>
            <summary className="text-foreground cursor-pointer font-medium">
              {GATED_HEADING}
            </summary>
            <div className="pt-3">
              <GatedTerms profile={profile} />
            </div>
          </details>
        </li>
        <li className="py-4">
          <details>
            <summary className="text-foreground cursor-pointer font-medium">{HELD_HEADING}</summary>
            <div className="flex flex-col gap-3 pt-3">
              <p className="text-muted-foreground text-sm text-pretty">{HELD_EXPLANATION}</p>
              <HeldTerms profile={profile} />
            </div>
          </details>
        </li>
      </ul>
    </div>
  );
}
