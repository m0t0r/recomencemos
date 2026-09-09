/**
 * `@repo/domain/accounts` — the Account aggregate, as far as anything outside
 * this package needs it.
 *
 * Better Auth owns the row and `@repo/domain/auth-handler` owns the session, so
 * what is left here is the state this product put on the Account itself: today
 * that is `offerSendingState`, and nothing else.
 *
 * **A subpath rather than a function on `./profiles`**, because the Account is a
 * different aggregate and ADR-0010 publishes per-aggregate subpaths. The freeze
 * is a fact about a Hirer, and a Hirer may hold no CapabilityProfile at all.
 */

import { eq } from "drizzle-orm";
import { db as pooledDatabase } from "#connection";
import type { DomainDatabase } from "#database";
import {
  asOfferSendingState,
  DEFAULT_OFFER_SENDING_STATE,
  MOST_RESTRICTIVE_OFFER_SENDING_STATE,
  type OfferSendingState,
} from "#policy/account-states";
import * as schema from "#schema";

/**
 * Whether this Account may send an Offer — read from the **row**, never from
 * the session.
 *
 * DD9 requires that of `sendOffer` for a reason that does not reach here: it
 * reads under a row lock because an unlocked read interleaves with the freeze
 * and an Offer gets through. This is a page read, and a freeze that lands
 * mid-read costs one page view. What the two share is the source — a session
 * cookie minted before a Report was filed would still say `active`, and a
 * freeze that a stale session could outlive is not a freeze.
 *
 * **An Account id that names no row reads as the default.** That is not an
 * assumption about the data: the caller has a live session, so the row existed
 * a moment ago, and the alternatives are worse in both directions — throwing
 * costs a Sentry event on a path a crawler can provoke (C51), and refusing
 * would turn a deleted Account into a silent 404 on a page it has nothing to do
 * with. The freeze is enforced at `sendOffer` under a lock regardless.
 *
 * **An unrecognised value reads as the most restrictive state, and that is the
 * opposite of the line above.** The two branches look alike and are not: a
 * missing row means the caller's own Account went away, which is a fact about
 * *this* request and says nothing about a freeze; an unrecognised value means
 * the column has stopped holding what this code can reason about. The first is
 * safe to read as `active` for the reasons above. The second is a value this
 * code cannot name, so it cannot be the basis for admitting anybody — and
 * `user_offer_sending_state_known` makes it unreachable through the schema, so
 * failing closed here costs nothing at all.
 *
 * This read used to answer `active` to both, which put the one member that
 * admits in the branch that fires when the data has stopped making sense.
 */
export async function readOfferSendingState(
  db: DomainDatabase,
  accountId: string,
): Promise<OfferSendingState> {
  const [row] = await db
    .select({ offerSendingState: schema.user.offerSendingState })
    .from(schema.user)
    .where(eq(schema.user.id, accountId))
    .limit(1);

  return stateOfRow(row?.offerSendingState);
}

function stateOfRow(stored: string | undefined): OfferSendingState {
  // No row at all: the session outlived its Account. See above.
  if (stored === undefined) return DEFAULT_OFFER_SENDING_STATE;

  // A row holding something outside the registry. See above.
  return asOfferSendingState(stored) ?? MOST_RESTRICTIVE_OFFER_SENDING_STATE;
}

/**
 * **The pooled binding: what a Server Component or Server Action calls.**
 *
 * ADR-0010 withholds `#connection`, so a caller outside this package has no
 * handle to pass and reaches the database through this object or not at all.
 */
export const accounts = {
  async offerSendingState(accountId: string): Promise<OfferSendingState> {
    return readOfferSendingState(pooledDatabase(), accountId);
  },
};

/**
 * **The type only, and deliberately not the registry or the predicate.**
 *
 * `OFFER_SENDING_STATES` and `mayReadGatedProfile` are pure rules and they live
 * on `@repo/domain/policy`, where every other closed set in this package is
 * published. Re-exporting them here would give one policy two public doors, and
 * a caller reaching for the second is a caller who would not notice if the two
 * ever disagreed. What this subpath publishes is the *read* — and the type its
 * result is named by, which has nowhere else to come from.
 */
export type { OfferSendingState } from "#policy/account-states";
