/**
 * Seam 1's coverage of the Offer state machine — **every transition and every
 * refused transition**, which is the phrasing the spec's Testing Decisions uses
 * for this module by name.
 *
 * The refused half is the half worth having. A machine tested only on the moves
 * it permits passes identically whether the guard is a whitelist or `return
 * true`, and the two differ exactly where an Offer somebody already declined can
 * be delivered a second time.
 */

import {
  asOfferState,
  INITIAL_OFFER_STATE,
  isOfferReviewDelayed,
  isTerminalOfferState,
  mayTransitionOffer,
  OFFER_REVIEW_WINDOW_HOURS,
  OFFER_STATES,
  type OfferState,
  PENDING_OFFER_STATES,
  RECEIVED_OFFER_STATES,
} from "#policy/offer-states";

/** Every ordered pair, so the table below is a partition rather than a sample. */
const EVERY_PAIR: readonly (readonly [OfferState, OfferState])[] = OFFER_STATES.flatMap((from) =>
  OFFER_STATES.map((to) => [from, to] as const),
);

/**
 * The moves this product has. Everything absent from here is refused, and the
 * test below asserts that over the whole cross product rather than over a list
 * somebody remembered to write.
 */
const PERMITTED: readonly (readonly [OfferState, OfferState])[] = [
  ["pending_review", "delivered"],
  ["pending_review", "on_hold"],
  ["pending_review", "rejected_by_admin"],
  ["on_hold", "pending_review"],
  ["on_hold", "rejected_by_admin"],
  ["delivered", "accepted"],
  ["delivered", "declined"],
  ["delivered", "expired"],
  ["delivered", "reported"],
];

function isPermitted(from: OfferState, to: OfferState): boolean {
  return PERMITTED.some(([a, b]) => a === from && b === to);
}

describe("the Offer state set", () => {
  it("starts at the state a person has not read yet", () => {
    expect(INITIAL_OFFER_STATE).toBe("pending_review");
  });

  it("holds every state the spec names and nothing else", () => {
    expect([...OFFER_STATES]).toEqual([
      "pending_review",
      "on_hold",
      "delivered",
      "accepted",
      "declined",
      "expired",
      "rejected_by_admin",
      "reported",
    ]);
  });

  it("counts both undelivered states as waiting on a person", () => {
    expect([...PENDING_OFFER_STATES]).toEqual(["pending_review", "on_hold"]);
  });

  /**
   * **What reaches her is a question about the whole set, so it is asked of the
   * whole set.** An Offer a person has not let through, one held because its
   * sender is frozen, and one we refused never reached her; one she Reported is
   * hidden from her. A state added later is absent from her list until somebody
   * says it belongs there — the same direction the transition whitelist fails in.
   */
  it.each(OFFER_STATES)("says whether an Offer in %s is one she has received", (state) => {
    const reachedHer = ["delivered", "accepted", "declined", "expired"].includes(state);

    expect((RECEIVED_OFFER_STATES as readonly OfferState[]).includes(state)).toBe(reachedHer);
  });

  it("narrows a string the database holds, and refuses one it does not", () => {
    expect(asOfferState("delivered")).toBe("delivered");
    expect(asOfferState("Delivered")).toBeUndefined();
    expect(asOfferState("entregada")).toBeUndefined();
    expect(asOfferState("")).toBeUndefined();
  });
});

describe("which moves are permitted", () => {
  it.each(PERMITTED)("%s → %s is allowed", (from, to) => {
    expect(mayTransitionOffer(from, to)).toBe(true);
  });

  const refused = EVERY_PAIR.filter(([from, to]) => !isPermitted(from, to));

  it.each(refused)("%s → %s is refused", (from, to) => {
    expect(mayTransitionOffer(from, to)).toBe(false);
  });

  it("refuses every move out of a terminal state", () => {
    const terminal = OFFER_STATES.filter((state) => isTerminalOfferState(state));

    expect([...terminal]).toEqual([
      "accepted",
      "declined",
      "expired",
      "rejected_by_admin",
      "reported",
    ]);

    for (const from of terminal) {
      for (const to of OFFER_STATES) expect(mayTransitionOffer(from, to)).toBe(false);
    }
  });

  it("refuses a move to the state it is already in", () => {
    for (const state of OFFER_STATES) expect(mayTransitionOffer(state, state)).toBe(false);
  });
});

describe("whether a review is taking longer than usual", () => {
  const sentAt = new Date("2026-09-08T10:00:00.000Z");
  const window = OFFER_REVIEW_WINDOW_HOURS * 60 * 60 * 1000;

  it("is false while the Offer is inside the window it was promised", () => {
    expect(isOfferReviewDelayed(sentAt, null, new Date(sentAt.getTime() + window - 1))).toBe(false);
  });

  it("is true the moment the window is reached, not an hour after it", () => {
    expect(isOfferReviewDelayed(sentAt, null, new Date(sentAt.getTime() + window))).toBe(true);
  });

  it("is false once a person has read it, however long that took", () => {
    const delivered = new Date(sentAt.getTime() + window * 3);

    expect(isOfferReviewDelayed(sentAt, delivered, new Date(sentAt.getTime() + window * 4))).toBe(
      false,
    );
  });

  it("is false when a clock runs backwards rather than reporting a negative wait", () => {
    expect(isOfferReviewDelayed(sentAt, null, new Date(sentAt.getTime() - window))).toBe(false);
  });
});
