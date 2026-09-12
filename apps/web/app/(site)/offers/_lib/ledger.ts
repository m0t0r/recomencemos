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

import { type ContactExchange, exchanges } from "@repo/domain/exchange";
import { offers, type ReceivedOffer } from "@repo/domain/offers";
import { profiles } from "@repo/domain/profiles";
import { requireAccountPage } from "@/lib/account";

/** The row a link named: rendered open, with the sentence an answer to it landed with. */
export interface OpenRow {
  readonly id: string;
  readonly arrival?: string | undefined;
  /** This render followed her acceptance: the Contact Exchange takes focus, not the sentence. */
  readonly justAccepted?: boolean;
}

export interface LedgerView {
  readonly offers: readonly ReceivedOffer[];
  /**
   * The Contact Exchanges on her accepted rows, as she reads them. **Only her
   * side's**: an Account that is also a Hirer is party to exchanges this page
   * has no row for, and they are left to `/sent-offers`.
   */
  readonly exchanges: readonly ContactExchange[];
  /** Only decides which empty state she meets: an Offer is addressed to a profile. */
  readonly hasProfile: boolean;
  readonly now: Date;
  readonly open?: OpenRow | undefined;
}

/** Signed out → `/sign-in`, with `returnPath` as the way back. */
export async function readLedger(returnPath: string): Promise<LedgerView> {
  const session = await requireAccountPage(returnPath);

  const [received, hasProfile, exchanged] = await Promise.all([
    offers.listReceived(session.accountId),
    profiles.has(session.accountId),
    exchanges.listForParty(session.accountId),
  ]);

  return {
    offers: received,
    exchanges: exchanged.filter((exchange) => exchange.side === "worker"),
    hasProfile,
    now: new Date(),
  };
}
