/**
 * The enum-shaped column on an Account, as a registry the `CHECK` constraint is
 * generated from (DD2) — beside `profile-states.ts`, which does the same job for
 * `capability_profile`.
 */

/**
 * **Whether this Account may send an Offer.**
 *
 * `frozen` is written by `reportOffer` in one transaction with the Report and is
 * lifted by an Admin's `unfreezeHirer`; `banned` is the Admin's own act and does
 * not lift. Neither is written yet — story 10 owns both writers, and this ticket
 * owns the first reader.
 *
 * **It is read at two surfaces and means two different things there**, which is
 * worth knowing before a third reader is added. At `sendOffer` it is the
 * requirement itself: from commit of a Report the reported Hirer sends **0**
 * further Offers, read from the row under a lock because an unlocked read
 * interleaves with the freeze. At `GET /profile/[slug]` it decides only whether
 * he is *served*, and the answer to `frozen` there is exactly the
 * missing-profile response — a freeze is not something the frozen person is told
 * about by the shape of a page.
 */
export const OFFER_SENDING_STATES = ["active", "frozen", "banned"] as const;
export type OfferSendingState = (typeof OFFER_SENDING_STATES)[number];

/** The state an Account holds until something takes it away. */
export const DEFAULT_OFFER_SENDING_STATE: OfferSendingState = "active";

/**
 * **Whether an Account in this state may read a gated profile.**
 *
 * A function rather than `state === "frozen"` at the call site, because there
 * are three states and only one of them is the requirement's own word. `banned`
 * is not named by story 5 at all — and reading it as "may read" because the
 * spec's sentence happens to say `frozen` would serve the whole gated catalogue
 * to the one principal an Admin has removed on purpose. So the predicate is
 * stated positively over the set, and a fourth state added to the registry
 * without a decision here is refused rather than admitted.
 */
export function mayReadGatedProfile(state: OfferSendingState): boolean {
  return state === "active";
}
