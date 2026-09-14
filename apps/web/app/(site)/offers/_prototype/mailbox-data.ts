/**
 * PROTOTYPE — one read for every mailbox variant: what reached her, what she
 * sent, and the Contact Exchanges on both sides. The real reads, read-only;
 * the time is read once so every row agrees about "hace 2 días".
 */

import { type ContactExchange, exchanges } from "@repo/domain/exchange";
import { offers, type ReceivedOffer, type SentOffer } from "@repo/domain/offers";
import { profiles } from "@repo/domain/profiles";
import { requireAccountPage } from "@/lib/account";

export interface Mailbox {
  readonly received: readonly ReceivedOffer[];
  readonly sent: readonly SentOffer[];
  /** Exchanges on Offers she received, keyed by Offer id. */
  readonly workerExchanges: ReadonlyMap<string, ContactExchange>;
  /** Exchanges on Offers she sent, keyed by Offer id. */
  readonly hirerExchanges: ReadonlyMap<string, ContactExchange>;
  readonly hasProfile: boolean;
  readonly now: Date;
}

export async function readMailbox(): Promise<Mailbox> {
  const session = await requireAccountPage("/offers");
  const now = new Date();

  const [received, sent, hasProfile, exchanged] = await Promise.all([
    offers.listReceived(session.accountId),
    offers.listSent(session.accountId, now),
    profiles.has(session.accountId),
    exchanges.listForParty(session.accountId),
  ]);

  const bySide = (side: ContactExchange["side"]) =>
    new Map(
      exchanged
        .filter((exchange) => exchange.side === side)
        .map((exchange) => [exchange.offerId, exchange]),
    );

  return {
    received,
    sent,
    workerExchanges: bySide("worker"),
    hirerExchanges: bySide("hirer"),
    hasProfile,
    now,
  };
}
