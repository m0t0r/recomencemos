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
import type { DomainDatabase } from "#database";
import {
  DEFAULT_OFFER_SENDING_STATE,
  type OfferSendingState,
  OFFER_SENDING_STATES,
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
 * **An unrecognised value reads as the default too, and that is the one to
 * argue with.** `user_offer_sending_state_known` refuses anything outside the
 * registry at write time, so this branch is unreachable through the schema —
 * it exists because `state as OfferSendingState` would be a cast that lies, and
 * a value this code cannot name is a value it cannot make a decision about.
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

  return asOfferSendingState(row?.offerSendingState);
}

function asOfferSendingState(value: string | undefined): OfferSendingState {
  return OFFER_SENDING_STATES.find((state) => state === value) ?? DEFAULT_OFFER_SENDING_STATE;
}

/**
 * **The pooled binding: what a Server Component or Server Action calls.**
 *
 * The dynamic import is the shape every public subpath here uses, and for the
 * reason `#rate-limit` sets out at length: `#connection` carries
 * `import "server-only"`, which throws under plain `node`, and a static import
 * would make this module unimportable at seam 1 and seam 2.
 */
export const accounts = {
  async offerSendingState(accountId: string): Promise<OfferSendingState> {
    const { db } = await import("#connection");
    return readOfferSendingState(db(), accountId);
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
