/**
 * Seam 1 over the Account's one enum-shaped column, and over the predicate that
 * reads it.
 *
 * The predicate is one line and is tested anyway, for the reason it is a
 * predicate rather than a comparison at the call site: it is a decision over a
 * *set*, and the thing worth pinning is what it says about the two members the
 * spec's sentence does not name.
 */

import {
  DEFAULT_OFFER_SENDING_STATE,
  mayReadGatedProfile,
  OFFER_SENDING_STATES,
  type OfferSendingState,
} from "#policy/account-states";

describe("the sending states", () => {
  // Retyped rather than derived, so widening the set is a decision somebody
  // takes here as well as in the registry — the same shape `gated-routes.test.ts`
  // uses on NFR8's prefixes.
  it("are the three the spec names, and nothing else", () => {
    expect([...OFFER_SENDING_STATES]).toEqual(["active", "frozen", "banned"]);
  });

  it("default to the one that restricts nothing", () => {
    expect(DEFAULT_OFFER_SENDING_STATE).toBe("active");
    expect(OFFER_SENDING_STATES).toContain(DEFAULT_OFFER_SENDING_STATE);
  });
});

describe("who may read a gated profile", () => {
  it("admits an Account nothing has been decided about", () => {
    expect(mayReadGatedProfile("active")).toBe(true);
  });

  /**
   * The requirement's own word. A frozen caller is refused here and told
   * nothing — the route answers with the missing-profile response, which is
   * where that half is asserted.
   */
  it("refuses an Account with an open Report against it", () => {
    expect(mayReadGatedProfile("frozen")).toBe(false);
  });

  /**
   * **The member story 5's sentence never names.** Reading the requirement
   * literally — refuse `frozen` — would serve the whole gated catalogue to the
   * one principal an Admin removed on purpose, which is the stricter state.
   */
  it("refuses an Account an Admin has banned", () => {
    expect(mayReadGatedProfile("banned")).toBe(false);
  });

  /**
   * Stated over the whole registry rather than over three literals, so a fourth
   * member added without a decision here is red rather than silently admitted.
   * Exactly one member may read.
   */
  it("admits exactly one of the states the registry declares", () => {
    const admitted = OFFER_SENDING_STATES.filter((state: OfferSendingState) =>
      mayReadGatedProfile(state),
    );

    expect(admitted).toEqual(["active"]);
  });
});
