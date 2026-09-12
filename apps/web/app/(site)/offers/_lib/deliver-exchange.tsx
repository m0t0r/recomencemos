/**
 * What happens after she accepts and the transaction has committed: the two
 * copies by email, one to each side, and where each one went.
 *
 * **After the commit, never inside it — and that ordering is the design.** A
 * transaction can roll back and a delivered email cannot, so a send inside it
 * would put the one irreversible act in this system inside a reversible scope.
 * `acceptOffer` in `@repo/domain/offers` writes the exchange and sends nothing;
 * this runs on what it handed back.
 *
 * **A failed copy never fails the accept.** The details are on both screens
 * already, which is why they are on screen: the email is a copy, and a copy
 * that did not go out is recorded against its own side — the page then says so,
 * to that side only — rather than undoing what she accepted. A transport fault
 * is logged at error level (the seam throws on one by contract); the
 * kill switch refusing a send is not an incident and is recorded the same way to
 * her, because to the person reading the page the fact is the same.
 *
 * **Both copies at once.** The two sends are independent, and the second should
 * not wait on the first's round trip while she waits on the redirect.
 *
 * A server module, reached only from `../actions.ts`. It is not in that file
 * because every export of a `"use server"` module is a callable endpoint.
 */

import { authBaseUrl } from "@repo/domain/auth-handler";
import { type ExchangeDelivery, type ExchangeSide, exchanges } from "@repo/domain/exchange";
import { createNotifierFromEnv } from "@repo/notifications/send";
import {
  CONTACT_EXCHANGE_SUBJECTS,
  ContactExchangeEmail,
} from "@repo/notifications/templates/contact-exchange";
import { logger } from "@repo/observability/logger";
import { logRequestError } from "@repo/observability/log-request-error";

/**
 * Where each side's copy points: the row that shows the same details. Both are
 * route constants plus a server-minted id, so no part of either URL is anything
 * a person typed (DD14).
 */
function siteRowFor(side: ExchangeSide, offerId: string): string {
  const path = side === "worker" ? `/offers/${offerId}` : "/sent-offers";

  return new URL(path, authBaseUrl(process.env)).toString();
}

async function sendCopy(exchange: ExchangeDelivery, side: ExchangeSide): Promise<void> {
  const recipient = side === "worker" ? exchange.worker : exchange.hirer;
  const counterpart = side === "worker" ? exchange.hirer : exchange.worker;

  let outcome: "sent" | "failed" = "failed";

  try {
    const sent = await createNotifierFromEnv(logger).send({
      kind: "contact-exchange",
      to: recipient.contact.email,
      // The identifier a log line may carry (NFR18). The address is not it.
      recipientId: recipient.accountId,
      // With the recipient, the idempotency key — so the two sides' copies are
      // two deliveries and a retry to either is still one.
      entityId: exchange.exchangeId,
      subject: CONTACT_EXCHANGE_SUBJECTS[side],
      body: (
        <ContactExchangeEmail
          recipientSide={side}
          counterpart={counterpart.contact}
          url={siteRowFor(side, exchange.offerId)}
        />
      ),
    });

    outcome = sent.status === "sent" ? "sent" : "failed";
  } catch (cause) {
    logRequestError(cause);
  }

  try {
    await exchanges.recordCopy(exchange.exchangeId, side, outcome);
  } catch (cause) {
    // The row stays `pending`, which the page reads as still sending. The copy
    // itself went where it went; only our record of it is missing.
    logRequestError(cause);
  }
}

/**
 * The exchange's line, then both copies.
 *
 * `exchange.created` is on the spec's closed list of logged transitions, carries
 * ids and nothing else, and is written here because the commit has happened —
 * a line written inside the transaction would survive a rollback as the record
 * of a crossing that did not occur.
 */
export async function deliverExchange(exchange: ExchangeDelivery): Promise<void> {
  logger.info(
    { event: "exchange.created", exchange_id: exchange.exchangeId, offer_id: exchange.offerId },
    "A Worker accepted an Offer and the Contact Exchange committed",
  );

  await Promise.all([sendCopy(exchange, "worker"), sendCopy(exchange, "hirer")]);
}
