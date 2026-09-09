/**
 * The badge on a sent-Offer row: a short label and the registry variant that
 * carries it.
 *
 * **The badge is text, and the sentence stays.** The brief settled this as *"a
 * sentence, not a badge"* on the argument that an alarm about our own queue,
 * aimed at somebody who cannot act on it, is pressure rather than information —
 * and that `voice.md` refuses meaning carried by colour alone. Both survive here
 * because the badge is a **label** rather than a colour: it is readable with the
 * stylesheet off, announced by a screen reader, and the full sentence sits
 * beside it. The brief is amended rather than contradicted, and says so.
 *
 * What the badge buys is the thing a sentence cannot: four rows scan as four
 * states in one glance, which is exactly what a person who sent four Offers
 * wants from this page.
 *
 * **No `destructive` anywhere on this surface, and that is the rule to keep.**
 * A declined Offer is a decision, not a failure; a delayed review is our fault
 * and not his; a rejected one is a moderation outcome he is told about plainly.
 * Painting any of them red would make the page an alarm about a person.
 */

import type { OfferState } from "@repo/domain/policy";

/** The registry's `Badge` variants this surface uses. */
export type OfferBadgeVariant = "default" | "secondary" | "outline";

export interface OfferBadge {
  readonly label: string;
  readonly variant: OfferBadgeVariant;
}

/**
 * One badge per state, plus the delayed case, which is not a state.
 *
 * Every label is two words or fewer, because a badge that wraps is a badge that
 * has stopped being scannable — which is the only thing it was for.
 */
const BADGES = {
  pending_review: { label: "En revisión", variant: "secondary" },
  on_hold: { label: "En revisión", variant: "secondary" },
  delivered: { label: "Le llegó", variant: "default" },
  accepted: { label: "Aceptada", variant: "default" },
  declined: { label: "No aceptada", variant: "outline" },
  expired: { label: "Vencida", variant: "outline" },
  rejected_by_admin: { label: "No pasó", variant: "outline" },
  reported: { label: "Reportada", variant: "outline" },
} as const satisfies Record<OfferState, OfferBadge>;

/**
 * The badge a row carries.
 *
 * **Delayed outranks the state**, for the same reason the sentence does: an Offer
 * past its window is still `pending_review`, and a row reading *En revisión* with
 * no other mark would say the ordinary thing about the one case this surface
 * exists to surface. `secondary` rather than a louder variant keeps it a fact
 * rather than an alarm.
 */
export function offerBadge(state: OfferState, reviewDelayed: boolean): OfferBadge {
  if (reviewDelayed) return { label: "Se está demorando", variant: "secondary" };

  return BADGES[state];
}
