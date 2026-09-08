/**
 * The Offer's states and the moves between them — the registry the `CHECK` on
 * `offer.state` is generated from, beside every other closed set in this
 * package.
 *
 * **The machine is a whitelist of ordered pairs, and that is the design.** The
 * spec's Testing Decisions asks seam 1 for _"every transition **and** every
 * refused transition"_, and a whitelist is what makes the second half a
 * question a test can put to the whole cross product: anything not written here
 * is refused, so a state added later is refused everywhere until somebody says
 * where it may go. A guard written as a chain of `if`s permits by omission,
 * which is the failure that lets an Offer already declined be delivered again.
 *
 * **`on_hold` sits on the `pending_review` branch rather than beside the
 * terminal ones** (Core entities, C22). An Offer whose sender is frozen is
 * *held*, not rejected, precisely so that clearing the Report releases it —
 * which is why `on_hold → pending_review` exists and why the two together are
 * {@link PENDING_OFFER_STATES}, the predicate the Admin queue counts and the
 * `deliveredAt IS NULL` window is about.
 *
 * **Nothing here reads a clock or opens a connection**, which is what makes it
 * seam 1's and what lets a Server Action call it with no handle.
 *
 * English identifiers under ADR-0012, like every other enum value in this
 * package.
 */

/**
 * Every state an Offer can be in.
 *
 * The order is the life of one Offer read top to bottom: the two states in which
 * it is waiting on a person, the state in which she has it, and the five ways it
 * ends. The `CHECK` reads it as a set, so the order costs nothing and buys the
 * reader something.
 */
export const OFFER_STATES = [
  "pending_review",
  "on_hold",
  "delivered",
  "accepted",
  "declined",
  "expired",
  "rejected_by_admin",
  "reported",
] as const;

export type OfferState = (typeof OFFER_STATES)[number];

/**
 * Where every Offer starts: written, immutable, and read by nobody yet.
 *
 * A constant rather than a literal at the insert, because the Admin queue's
 * predicate, the sent-Offer list's copy and the insert all have to mean the same
 * state, and three literals is three places for them to stop meaning it.
 */
export const INITIAL_OFFER_STATE = "pending_review" satisfies OfferState;

/**
 * The states in which an Offer is waiting on a person — NFR7's queue depth, the
 * age-of-oldest, and the sentence `/sent-offers` renders about the normal window.
 *
 * **`on_hold` is in here and that is deliberate.** It is undelivered work that a
 * human still owes an answer on; leaving it out would let a Report against one
 * Hirer quietly shrink the number the operator is measured by, which is the
 * instrument lying about exactly the thing it exists to report.
 */
export const PENDING_OFFER_STATES = ["pending_review", "on_hold"] as const satisfies readonly
  OfferState[];

/**
 * NFR7's band, in hours: the age of the oldest undelivered Offer stays under it.
 *
 * It is here rather than only in the Admin queue's registry because two surfaces
 * quote it — the queue marks a section late against it, and `/sent-offers` tells
 * a Hirer what the normal window is and says plainly when his own Offer has
 * passed it. One number, one place.
 */
export const OFFER_REVIEW_WINDOW_HOURS = 24;

/**
 * The moves this product has. Everything absent is refused; see the class
 * comment for why that direction is the load-bearing one.
 *
 * A terminal state is one whose entry is empty, so {@link isTerminalOfferState}
 * is a reading of this table rather than a second list that has to agree with it.
 */
const PERMITTED_TRANSITIONS: Readonly<Record<OfferState, readonly OfferState[]>> = {
  /** An Admin delivers it, holds it because its sender was frozen, or rejects it. */
  pending_review: ["delivered", "on_hold", "rejected_by_admin"],

  /**
   * Clearing the Report puts it back in the queue; upholding the Report ends it.
   * It never reaches a Worker from here — release is what delivery is reached
   * through, so a held Offer is read by a person before she is.
   */
  on_hold: ["pending_review", "rejected_by_admin"],

  /** Hers now: she answers it, the expiry job closes it, or she Reports it. */
  delivered: ["accepted", "declined", "expired", "reported"],

  accepted: [],
  declined: [],
  expired: [],
  rejected_by_admin: [],
  reported: [],
};

/** Whether this move is one the product has. */
export function mayTransitionOffer(from: OfferState, to: OfferState): boolean {
  return PERMITTED_TRANSITIONS[from].includes(to);
}

/** Whether nothing may follow this state. */
export function isTerminalOfferState(state: OfferState): boolean {
  return PERMITTED_TRANSITIONS[state].length === 0;
}

/**
 * Narrow a string the database handed back, or nothing.
 *
 * The `CHECK` makes an unknown value unreachable through the schema, so this is
 * the same backstop `asOfferSendingState` is: a caller decides what to do with
 * the `undefined` rather than being handed a lie.
 */
export function asOfferState(value: string): OfferState | undefined {
  return (OFFER_STATES as readonly string[]).includes(value) ? (value as OfferState) : undefined;
}

/**
 * Whether an Offer's review has passed the window its sender was promised —
 * `SentOffer.reviewDelayed`, which is **a projection rather than a stored
 * state** (C41).
 *
 * **A derived value and not a column**, because the alternative is a job that
 * rewrites rows on a clock to say something arithmetic already knows, and a row
 * whose state depends on when a job last ran. The comparison is `>=` for the
 * same reason the queue's own band is: an Offer that has reached the window has
 * reached it, and a detector that waited for the twenty-fifth hour would report
 * everything fine for the whole of the hour the requirement is about.
 *
 * **Delivered is never delayed, whatever it took.** The sentence this drives
 * says *this one is taking longer than usual*, in the present tense, and it is
 * false about an Offer she is already reading.
 *
 * The clock is a parameter, so nothing under here reads the current time — the
 * rule Cache Components enforces from the other side, and what keeps this
 * testable at seam 1.
 */
export function isOfferReviewDelayed(sentAt: Date, deliveredAt: Date | null, now: Date): boolean {
  if (deliveredAt !== null) return false;

  const elapsedHours = (now.getTime() - sentAt.getTime()) / 3_600_000;

  return elapsedHours >= OFFER_REVIEW_WINDOW_HOURS;
}
