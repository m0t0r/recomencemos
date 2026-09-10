/**
 * The pieces `/offers` and `/offers/[id]` both render: the state label and one
 * term of the Offer. Server Components, and nothing here is interactive.
 *
 * **The state is a text label**, as `/sent-offers` settled: readable with the
 * stylesheet off, announced by a screen reader, and never `destructive` — no
 * state on these surfaces is an alarm, and the one that waits on her is the
 * calmest `secondary` rather than the filled primary that reads as *do this*.
 */

import { Badge } from "@repo/design-system/components/badge";
import { RECEIVED_STATE_LABELS, type ReceivedState } from "../_lib/messages";

export function OfferStateBadge({
  state,
  className,
}: {
  readonly state: ReceivedState;
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
export function OfferTerm({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="whitespace-pre-line">{value}</dd>
    </div>
  );
}
