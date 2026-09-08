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
 * **The state to fall back to when the stored value is not one this code knows.**
 *
 * `banned`, because every reader of this column is deciding whether to *let
 * something happen*, and a value outside the registry is a value the decision
 * cannot be made from. `user_offer_sending_state_known` refuses anything else at
 * write time, so this is unreachable through the schema — which is exactly why
 * it costs nothing to point it at the restrictive end. The alternative, and what
 * this replaced, was falling back to `active`: the one member that admits, in
 * the one branch that fires when the data has stopped making sense.
 *
 * It is **not** the fallback for an Account id that names no row. That is a
 * different question with a different answer, and `#accounts` argues it there.
 */
export const MOST_RESTRICTIVE_OFFER_SENDING_STATE: OfferSendingState = "banned";

/**
 * The registry as a narrowing function — `undefined` when the value is not one
 * of ours, so each caller says what it wants to do about that rather than
 * inheriting a decision from a cast.
 *
 * **One narrower rather than a cast at each reader.** `export.ts` used
 * `state as OfferSendingState` while `#accounts` argued three paragraphs above
 * its own read that such a cast "would be a cast that lies" — two readers of one
 * column disagreeing about whether its values can be trusted, in one commit.
 */
export function asOfferSendingState(value: string | undefined): OfferSendingState | undefined {
  return OFFER_SENDING_STATES.find((state) => state === value);
}

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
