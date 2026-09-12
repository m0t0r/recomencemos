/**
 * What the ledger is drawn from: her received Offers, whether she holds a
 * profile, and the time — read once, together, for both routes.
 *
 * **One read serves the whole page.** `offers.listReceived` carries every field
 * an open row shows, the Hirer's declared name included, and it carries no
 * `LIMIT`, so it is every Offer that has reached her. That is what lets
 * `/offers/[id]` answer "not the addressee" by the Offer's absence from this
 * list rather than by a second, differently-scoped read.
 *
 * **The clock is read here, once**, so every row on the screen agrees about
 * what _hace 2 días_ means. It is read after the session, which is a request
 * read, so a prerender never reaches it.
 */

import { offers, type ReceivedOffer } from "@repo/domain/offers";
import { profiles } from "@repo/domain/profiles";
import { requireAccountPage } from "@/lib/account";

/** The row a link named: rendered open, with the sentence an answer to it landed with. */
export interface OpenRow {
  readonly id: string;
  readonly arrival?: string | undefined;
}

export interface LedgerView {
  readonly offers: readonly ReceivedOffer[];
  /** Only decides which empty state she meets: an Offer is addressed to a profile. */
  readonly hasProfile: boolean;
  readonly now: Date;
  readonly open?: OpenRow | undefined;
}

/** Signed out → `/sign-in`, with `returnPath` as the way back. */
export async function readLedger(returnPath: string): Promise<LedgerView> {
  const session = await requireAccountPage(returnPath);

  const [received, hasProfile] = await Promise.all([
    offers.listReceived(session.accountId),
    profiles.has(session.accountId),
  ]);

  return { offers: received, hasProfile, now: new Date() };
}
