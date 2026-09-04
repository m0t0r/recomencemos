/**
 * The one signal that is about the platform rather than about a profile.
 *
 * **A signal is not a queue item.** It never becomes a row, never carries an
 * action, and never refuses anything: C24's own wording is that publishing is
 * never refused and the queue simply says the rate is unusual. That is why the
 * threshold lives on the surface that speaks rather than in `@repo/domain` beside
 * the count — the domain answers "how many", and when that number is worth
 * saying out loud is a decision about this screen.
 *
 * **Exactly four signals exist and three of them are not here.** The duplicate
 * phone, a profile filing more than three Reports in seven days, and a profile
 * completing more than five Contact Exchanges with distinct Hirers in seven days
 * are all about *one profile*, so they ride on that profile's row where the
 * decision is made — a warning at the top of the shell while its profile is
 * judged three hundred pixels below it is a warning in the wrong place. A fifth
 * signal is a spec amendment, not a ticket.
 */

/** The rolling window the rate is measured over. */
export const PUBLISH_RATE_WINDOW_MS = 3_600_000;

/**
 * Above this many published profiles in one rolling hour, the queue says so.
 *
 * Ten sits well above ordinary traffic at three municipalities and launch volume,
 * and **announcement day will trip it, which is correct**: the one day a flood
 * could hide inside real traffic is the day the operator wants to be looking.
 *
 * Per-IP was rejected with a reason: every request arrives through the platform's
 * proxy, so a flood from one person on mobile data rotates addresses while a
 * shared household connection trips the signal — it misses the case it exists for
 * and fires on the case it does not.
 */
export const PUBLISH_RATE_THRESHOLD = 10;

/** Where the rolling hour starts, given the shell's one clock reading. */
export function publishRateWindowStart(now: Date): Date {
  return new Date(now.getTime() - PUBLISH_RATE_WINDOW_MS);
}

/**
 * Whether the rate is worth saying out loud.
 *
 * **Strictly above**, because the threshold is the top of ordinary rather than
 * the bottom of unusual — a stated ceiling of ten that fired at ten would make
 * the number in the copy disagree with the number in the code.
 *
 * **And it says nothing at all below it**, which is the anti-dashboard rule: the
 * shell is not a place that reports a healthy rate every day. There are exactly
 * four signals here and none of them is a vanity count.
 */
export function publishRateIsUnusual(publishedInWindow: number): boolean {
  return publishedInWindow > PUBLISH_RATE_THRESHOLD;
}
