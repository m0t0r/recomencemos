/**
 * What the page is drawn from: every Offer the Account received and every one it
 * sent, the Contact Exchanges on both sides, whether it holds a profile, and the
 * time — read once, together, for both routes.
 *
 * **Both reads are scoped by the principal in their own `where` clause and carry
 * no `LIMIT`**, so an Offer absent from both is one this Account is not party to.
 * That is what lets `/offers/[id]` answer "not yours" by absence rather than by a
 * second, differently-scoped read — a missing id, somebody else's, one not yet
 * let through and one she Reported are the same answer.
 *
 * **The clock is read here, once, after the session**, which is a request read,
 * so a prerender never reaches it and every row agrees about _hace 2 días_ and
 * about which review is past its window.
 *
 * What to draw from it is `mailbox-view.ts`'s, which is pure.
 */

import { exchanges } from "@repo/domain/exchange";
import { offers } from "@repo/domain/offers";
import { profiles } from "@repo/domain/profiles";
import { requireAccountPage } from "@/lib/account";
import type { MailboxData } from "./mailbox-view";

/** Signed out → `/sign-in`, with `returnPath` as the way back. */
export async function readMailbox(returnPath: string): Promise<MailboxData> {
  const session = await requireAccountPage(returnPath);
  const now = new Date();

  const [received, sent, hasProfile, exchanged] = await Promise.all([
    offers.listReceived(session.accountId),
    offers.listSent(session.accountId, now),
    profiles.has(session.accountId),
    exchanges.listForParty(session.accountId),
  ]);

  return { received, sent, exchanges: exchanged, hasProfile, now };
}
