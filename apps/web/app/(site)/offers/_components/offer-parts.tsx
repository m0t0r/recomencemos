/**
 * The pieces both sides of `/offers` render: the state label and the Offer's
 * terms. Server Components, and nothing here is interactive.
 *
 * **The state is a text label**, as `/sent-offers` settled: readable with the
 * stylesheet off, announced by a screen reader, and never `destructive` — no
 * state on these surfaces is an alarm, and the one that waits on her is the
 * calmest `secondary` rather than the filled primary that reads as *do this*.
 */

import { Badge } from "@repo/design-system/components/badge";
import type { ReceivedOfferState } from "@repo/domain/offers";
import {
  OFFER_PAY_LABEL,
  OFFER_WHEN_LABEL,
  OFFER_WORK_LABEL,
  RECEIVED_STATE_LABELS,
} from "../_lib/messages";

export function OfferStateBadge({
  state,
  className,
}: {
  readonly state: ReceivedOfferState;
  readonly className?: string;
}) {
  return (
    <Badge variant={state === "delivered" ? "secondary" : "outline"} className={className}>
      {RECEIVED_STATE_LABELS[state]}
    </Badge>
  );
}

/**
 * One of the three things he wrote. `whitespace-pre-line`, because a line break
 * he typed is part of what he wrote — and React escapes the text, so a break is
 * the only formatting that survives.
 */
function OfferTerm({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="whitespace-pre-line">{value}</dd>
    </div>
  );
}

/**
 * The three terms, under the same labels on both sides: what she agrees to is
 * what he wrote, and one component is what keeps the two from drifting apart.
 */
export function OfferTerms({
  offer,
}: {
  readonly offer: {
    readonly workDescription: string;
    readonly payTerms: string;
    readonly whenText: string;
  };
}) {
  return (
    <dl className="flex flex-col gap-4">
      <OfferTerm label={OFFER_WORK_LABEL} value={offer.workDescription} />
      <OfferTerm label={OFFER_PAY_LABEL} value={offer.payTerms} />
      <OfferTerm label={OFFER_WHEN_LABEL} value={offer.whenText} />
    </dl>
  );
}
