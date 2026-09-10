/**
 * Which of an Offer's states these surfaces render.
 *
 * The domain's reads only ever hand over a received state, so this is the
 * narrowing the type system needs rather than a filter — and it refuses to render
 * anything the read should not have handed over rather than guessing at a label.
 * It reads the label table, which is keyed on the domain's own list, so the two
 * cannot disagree about the set.
 */

import type { OfferState, ReceivedOfferState } from "@repo/domain/offers";
import { RECEIVED_STATE_LABELS } from "./messages";

export function asReceivedState(state: OfferState): ReceivedOfferState | undefined {
  return Object.hasOwn(RECEIVED_STATE_LABELS, state) ? (state as ReceivedOfferState) : undefined;
}
